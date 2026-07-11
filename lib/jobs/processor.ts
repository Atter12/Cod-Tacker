import { computeRetryAt } from "@/lib/jobs/backoff";
import {
  isPermanentJobError,
  PermanentJobError,
} from "@/lib/jobs/errors";
import { getJobHandler } from "@/lib/jobs/handlers/registry";
import type {
  JobHandlerResult,
  JobsAdminClient,
  ProcessBatchResult,
} from "@/lib/jobs/types";
import type { BackgroundJobRow } from "@/types/database";
import type { Json } from "@/types/database.generated";
import { AppError } from "@/lib/errors/AppError";

const DEFAULT_STUCK_MS = 15 * 60 * 1_000;

function sanitizeResult(result: JobHandlerResult): Json {
  return {
    ok: result.ok,
    action: result.action,
    entityType: result.entityType ?? null,
    entityId: result.entityId ?? null,
    detail: result.detail ?? null,
  };
}

function errorMeta(error: unknown): { code: string; message: string } {
  if (error instanceof AppError) {
    return { code: error.code, message: error.safeMessage };
  }
  if (error instanceof Error) {
    return { code: "JOB_FAILED", message: "Error interno al procesar el trabajo." };
  }
  return { code: "JOB_FAILED", message: "Error desconocido al procesar el trabajo." };
}

async function markRawEvent(
  admin: JobsAdminClient,
  rawEventId: string | null,
  patch: {
    status: DatabaseEventStatus;
    processed_at?: string | null;
    last_error?: string | null;
    error_code?: string | null;
    next_retry_at?: string | null;
    dead_lettered_at?: string | null;
    attempts?: number;
  },
) {
  if (!rawEventId) return;
  await admin.from("raw_events").update(patch).eq("id", rawEventId);
}

type DatabaseEventStatus =
  | "received"
  | "validated"
  | "processing"
  | "processed"
  | "ignored"
  | "retrying"
  | "failed"
  | "dead_letter";

async function completeJob(
  admin: JobsAdminClient,
  job: BackgroundJobRow,
  attemptId: string,
  startedMs: number,
  result: JobHandlerResult,
) {
  const finishedAt = new Date().toISOString();
  await admin
    .from("job_attempts")
    .update({
      status: "completed",
      finished_at: finishedAt,
      duration_ms: Date.now() - startedMs,
      result: sanitizeResult(result),
    })
    .eq("id", attemptId);

  await admin
    .from("background_jobs")
    .update({
      status: "completed",
      finished_at: finishedAt,
      locked_at: null,
      locked_by: null,
      last_error_code: null,
      last_error_message: null,
    })
    .eq("id", job.id);

  await markRawEvent(admin, job.raw_event_id, {
    status: "processed",
    processed_at: finishedAt,
    last_error: null,
    error_code: null,
    next_retry_at: null,
  });
}

async function failJob(
  admin: JobsAdminClient,
  job: BackgroundJobRow,
  attemptId: string,
  startedMs: number,
  error: unknown,
) {
  const finishedAt = new Date().toISOString();
  const { code, message } = errorMeta(error);
  const permanent = isPermanentJobError(error);
  const exhausted = job.attempts >= job.max_attempts;
  const shouldDeadLetter = permanent || exhausted;

  await admin
    .from("job_attempts")
    .update({
      status: "failed",
      finished_at: finishedAt,
      duration_ms: Date.now() - startedMs,
      error_code: code,
      error_message: message,
    })
    .eq("id", attemptId);

  if (shouldDeadLetter) {
    await admin
      .from("background_jobs")
      .update({
        status: "dead_letter",
        finished_at: finishedAt,
        locked_at: null,
        locked_by: null,
        last_error_code: code,
        last_error_message: message,
      })
      .eq("id", job.id);

    await markRawEvent(admin, job.raw_event_id, {
      status: "dead_letter",
      dead_lettered_at: finishedAt,
      last_error: message,
      error_code: code,
      attempts: job.attempts,
    });
    return "dead_letter" as const;
  }

  const retryAt = computeRetryAt(job.attempts, undefined, undefined, `${job.id}:${job.attempts}`);
  await admin
    .from("background_jobs")
    .update({
      status: "retry_scheduled",
      run_at: retryAt.toISOString(),
      locked_at: null,
      locked_by: null,
      last_error_code: code,
      last_error_message: message,
      finished_at: null,
    })
    .eq("id", job.id);

  await markRawEvent(admin, job.raw_event_id, {
    status: "retrying",
    next_retry_at: retryAt.toISOString(),
    last_error: message,
    error_code: code,
    attempts: job.attempts,
  });
  return "retried" as const;
}

/**
 * Processes a single claimed job (status already `processing`, attempts incremented by RPC).
 */
export async function processClaimedJob(
  admin: JobsAdminClient,
  job: BackgroundJobRow,
): Promise<"completed" | "retried" | "dead_letter" | "failed"> {
  const startedMs = Date.now();
  const attemptInsert = await admin
    .from("job_attempts")
    .insert({
      job_id: job.id,
      attempt_number: Math.max(1, job.attempts),
      status: "started",
    })
    .select("id")
    .single();

  if (attemptInsert.error || !attemptInsert.data) {
    await admin
      .from("background_jobs")
      .update({
        status: "retry_scheduled",
        run_at: computeRetryAt(job.attempts, undefined, undefined, job.id).toISOString(),
        locked_at: null,
        locked_by: null,
        last_error_code: "ATTEMPT_CREATE_FAILED",
        last_error_message: "No se pudo registrar el intento.",
      })
      .eq("id", job.id);
    return "failed";
  }

  const attemptId = attemptInsert.data.id;
  const handler = getJobHandler(job.job_type);

  try {
    if (!handler) {
      throw new PermanentJobError(
        "UNKNOWN_JOB_TYPE",
        `Tipo de trabajo no registrado: ${job.job_type}`,
      );
    }
    await markRawEvent(admin, job.raw_event_id, { status: "processing" });
    const result = await handler({ admin, job, payload: job.payload });
    await completeJob(admin, job, attemptId, startedMs, result);
    return "completed";
  } catch (error) {
    return failJob(admin, job, attemptId, startedMs, error);
  }
}

/**
 * Claims up to `limit` jobs via `claim_background_jobs` RPC and processes each once.
 * Uses the service-role client; do not call from user-scoped clients.
 */
export async function processJobBatch(
  admin: JobsAdminClient,
  options: { workerId: string; limit?: number; queue?: string } = {
    workerId: "worker",
  },
): Promise<ProcessBatchResult> {
  const limit = Math.min(Math.max(options.limit ?? 10, 1), 50);
  const claim = await admin.rpc("claim_background_jobs", {
    p_worker_id: options.workerId,
    p_limit: limit,
    p_queue: options.queue ?? "default",
  });

  if (claim.error) {
    throw new AppError("DATABASE_ERROR", 500, "No se pudieron reclamar trabajos.", {
      cause: claim.error,
    });
  }

  const raw = claim.data as BackgroundJobRow[] | BackgroundJobRow | null;
  const jobs: BackgroundJobRow[] = Array.isArray(raw) ? raw : raw ? [raw] : [];
  const summary: ProcessBatchResult = {
    claimed: jobs.length,
    completed: 0,
    retried: 0,
    deadLetter: 0,
    failed: 0,
    jobIds: jobs.map((j) => j.id),
  };

  for (const job of jobs) {
    const outcome = await processClaimedJob(admin, job);
    if (outcome === "completed") summary.completed += 1;
    else if (outcome === "retried") summary.retried += 1;
    else if (outcome === "dead_letter") summary.deadLetter += 1;
    else summary.failed += 1;
  }

  return summary;
}

/**
 * Requeues jobs stuck in `processing` past the lock threshold (worker crash recovery).
 */
export async function recoverStuckJobs(
  admin: JobsAdminClient,
  options: { olderThanMs?: number; limit?: number } = {},
): Promise<number> {
  const olderThanMs = options.olderThanMs ?? DEFAULT_STUCK_MS;
  const limit = Math.min(Math.max(options.limit ?? 50, 1), 100);
  const cutoff = new Date(Date.now() - olderThanMs).toISOString();

  const stuck = await admin
    .from("background_jobs")
    .select("id, attempts")
    .eq("status", "processing")
    .lt("locked_at", cutoff)
    .order("locked_at", { ascending: true })
    .limit(limit);

  if (stuck.error) {
    throw new AppError("DATABASE_ERROR", 500, "No se pudieron recuperar trabajos bloqueados.", {
      cause: stuck.error,
    });
  }

  let recovered = 0;
  for (const row of stuck.data ?? []) {
    const runAt = computeRetryAt(row.attempts || 1, undefined, undefined, `stuck:${row.id}`);
    const update = await admin
      .from("background_jobs")
      .update({
        status: "retry_scheduled",
        run_at: runAt.toISOString(),
        locked_at: null,
        locked_by: null,
        last_error_code: "STUCK_RECOVERED",
        last_error_message: "Trabajo recuperado tras bloqueo prolongado.",
      })
      .eq("id", row.id)
      .eq("status", "processing");
    if (!update.error) recovered += 1;
  }
  return recovered;
}

/** Platform-admin / ops: requeue a failed, dead_letter, or cancelled job. */
export async function retryJob(admin: JobsAdminClient, jobId: string): Promise<BackgroundJobRow> {
  const existing = await admin.from("background_jobs").select().eq("id", jobId).maybeSingle();
  if (existing.error || !existing.data) {
    throw new AppError("NOT_FOUND", 404, "Trabajo no encontrado.");
  }
  const status = existing.data.status;
  if (!["failed", "dead_letter", "cancelled", "retry_scheduled"].includes(status)) {
    throw new AppError("INVALID_STATE", 400, "El trabajo no se puede reintentar en su estado actual.");
  }

  const updated = await admin
    .from("background_jobs")
    .update({
      status: "queued",
      run_at: new Date().toISOString(),
      locked_at: null,
      locked_by: null,
      finished_at: null,
      last_error_code: null,
      last_error_message: null,
    })
    .eq("id", jobId)
    .select()
    .single();
  if (updated.error || !updated.data) {
    throw new AppError("DATABASE_ERROR", 500, "No se pudo reencolar el trabajo.");
  }

  if (updated.data.raw_event_id) {
    await markRawEvent(admin, updated.data.raw_event_id, {
      status: "received",
      dead_lettered_at: null,
      next_retry_at: null,
      last_error: null,
      error_code: null,
    });
  }

  return updated.data;
}

/** Platform-admin / ops: cancel a queued or retry-scheduled job. */
export async function cancelJob(admin: JobsAdminClient, jobId: string): Promise<BackgroundJobRow> {
  const existing = await admin.from("background_jobs").select().eq("id", jobId).maybeSingle();
  if (existing.error || !existing.data) {
    throw new AppError("NOT_FOUND", 404, "Trabajo no encontrado.");
  }
  if (!["queued", "retry_scheduled", "processing"].includes(existing.data.status)) {
    throw new AppError("INVALID_STATE", 400, "El trabajo no se puede cancelar en su estado actual.");
  }

  const updated = await admin
    .from("background_jobs")
    .update({
      status: "cancelled",
      finished_at: new Date().toISOString(),
      locked_at: null,
      locked_by: null,
      last_error_code: "CANCELLED",
      last_error_message: "Cancelado por un administrador.",
    })
    .eq("id", jobId)
    .select()
    .single();
  if (updated.error || !updated.data) {
    throw new AppError("DATABASE_ERROR", 500, "No se pudo cancelar el trabajo.");
  }
  return updated.data;
}
