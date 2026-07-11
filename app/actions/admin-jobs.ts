"use server";

import { revalidatePath } from "next/cache";
import { actionFail, actionOk, type ActionResult } from "@/lib/actions/action-result";
import { requirePlatformAdmin } from "@/lib/auth/require-platform-admin";
import { AppError } from "@/lib/errors/AppError";
import { cancelJob, processJobBatch, retryJob } from "@/lib/jobs/processor";
import { createAdminClient } from "@/lib/supabase/admin";
import { routes } from "@/config/routes";

export type AdminJobsActionResult = ActionResult<{
  id?: string;
  claimed?: number;
  completed?: number;
  retried?: number;
  deadLetter?: number;
}>;

function revalidateAdminOps() {
  revalidatePath(routes.admin.jobs);
  revalidatePath(routes.admin.webhooks);
  revalidatePath(routes.admin.deadLetter);
}

export async function retryJobAction(jobId: string): Promise<AdminJobsActionResult> {
  try {
    await requirePlatformAdmin();
    const admin = createAdminClient();
    const row = await retryJob(admin, jobId);
    revalidateAdminOps();
    return actionOk({ id: row.id });
  } catch (error) {
    return actionFail(error);
  }
}

export async function cancelJobAction(jobId: string): Promise<AdminJobsActionResult> {
  try {
    await requirePlatformAdmin();
    const admin = createAdminClient();
    const row = await cancelJob(admin, jobId);
    revalidateAdminOps();
    return actionOk({ id: row.id });
  } catch (error) {
    return actionFail(error);
  }
}

export async function processJobsBatchAction(
  limit = 10,
): Promise<AdminJobsActionResult> {
  try {
    await requirePlatformAdmin();
    const admin = createAdminClient();
    const result = await processJobBatch(admin, {
      workerId: `admin:${Date.now()}`,
      limit: Math.min(Math.max(limit, 1), 50),
    });
    revalidateAdminOps();
    return actionOk({
      claimed: result.claimed,
      completed: result.completed,
      retried: result.retried,
      deadLetter: result.deadLetter,
    });
  } catch (error) {
    return actionFail(error);
  }
}

/** Requeue a raw_event and any linked dead-letter / failed jobs. */
export async function retryRawEventAction(eventId: string): Promise<AdminJobsActionResult> {
  try {
    await requirePlatformAdmin();
    const admin = createAdminClient();
    const existing = await admin.from("raw_events").select().eq("id", eventId).maybeSingle();
    if (existing.error || !existing.data) {
      throw new AppError("NOT_FOUND", 404, "Evento no encontrado.");
    }
    if (!["failed", "dead_letter", "ignored", "retrying"].includes(existing.data.status)) {
      throw new AppError("INVALID_STATE", 400, "El evento no se puede reintentar en su estado actual.");
    }

    const updated = await admin
      .from("raw_events")
      .update({
        status: "received",
        dead_lettered_at: null,
        next_retry_at: null,
        last_error: null,
        error_code: null,
        processed_at: null,
      })
      .eq("id", eventId)
      .select("id")
      .single();
    if (updated.error || !updated.data) {
      throw new AppError("DATABASE_ERROR", 500, "No se pudo reencolar el evento.");
    }

    const jobs = await admin
      .from("background_jobs")
      .select("id, status")
      .eq("raw_event_id", eventId)
      .in("status", ["failed", "dead_letter", "cancelled", "retry_scheduled"]);

    for (const job of jobs.data ?? []) {
      await retryJob(admin, job.id);
    }

    revalidateAdminOps();
    return actionOk({ id: updated.data.id });
  } catch (error) {
    return actionFail(error);
  }
}

export async function ignoreRawEventAction(eventId: string): Promise<AdminJobsActionResult> {
  try {
    await requirePlatformAdmin();
    const admin = createAdminClient();
    const existing = await admin.from("raw_events").select().eq("id", eventId).maybeSingle();
    if (existing.error || !existing.data) {
      throw new AppError("NOT_FOUND", 404, "Evento no encontrado.");
    }

    const updated = await admin
      .from("raw_events")
      .update({
        status: "ignored",
        last_error: existing.data.last_error ?? "Ignorado por un administrador.",
        error_code: existing.data.error_code ?? "IGNORED",
        next_retry_at: null,
      })
      .eq("id", eventId)
      .select("id")
      .single();
    if (updated.error || !updated.data) {
      throw new AppError("DATABASE_ERROR", 500, "No se pudo ignorar el evento.");
    }

    const openJobs = await admin
      .from("background_jobs")
      .select("id, status")
      .eq("raw_event_id", eventId)
      .in("status", ["queued", "retry_scheduled", "processing", "failed", "dead_letter"]);

    for (const job of openJobs.data ?? []) {
      if (["queued", "retry_scheduled", "processing"].includes(job.status)) {
        await cancelJob(admin, job.id);
      } else {
        await admin
          .from("background_jobs")
          .update({
            status: "cancelled",
            finished_at: new Date().toISOString(),
            last_error_code: "IGNORED",
            last_error_message: "Evento marcado como ignorado.",
          })
          .eq("id", job.id);
      }
    }

    revalidateAdminOps();
    return actionOk({ id: updated.data.id });
  } catch (error) {
    return actionFail(error);
  }
}

/** Dead-letter convenience: retry job or event by kind. */
export async function retryDeadLetterAction(
  id: string,
  kind: "job" | "event",
): Promise<AdminJobsActionResult> {
  if (kind === "job") return retryJobAction(id);
  return retryRawEventAction(id);
}

export async function ignoreDeadLetterAction(
  id: string,
  kind: "job" | "event",
): Promise<AdminJobsActionResult> {
  try {
    await requirePlatformAdmin();
    if (kind === "event") return ignoreRawEventAction(id);

    const admin = createAdminClient();
    const existing = await admin.from("background_jobs").select().eq("id", id).maybeSingle();
    if (existing.error || !existing.data) {
      throw new AppError("NOT_FOUND", 404, "Trabajo no encontrado.");
    }
    if (existing.data.status !== "dead_letter" && existing.data.status !== "failed") {
      throw new AppError("INVALID_STATE", 400, "Solo se pueden ignorar trabajos fallidos o en cola de errores.");
    }
    const updated = await admin
      .from("background_jobs")
      .update({
        status: "cancelled",
        finished_at: new Date().toISOString(),
        last_error_code: "IGNORED",
        last_error_message: "Marcado como ignorado desde cola de errores.",
      })
      .eq("id", id)
      .select("id")
      .single();
    if (updated.error || !updated.data) {
      throw new AppError("DATABASE_ERROR", 500, "No se pudo ignorar el trabajo.");
    }
    if (existing.data.raw_event_id) {
      await admin
        .from("raw_events")
        .update({
          status: "ignored",
          error_code: "IGNORED",
          last_error: "Marcado como ignorado desde cola de errores.",
          next_retry_at: null,
        })
        .eq("id", existing.data.raw_event_id);
    }
    revalidateAdminOps();
    return actionOk({ id: updated.data.id });
  } catch (error) {
    return actionFail(error);
  }
}
