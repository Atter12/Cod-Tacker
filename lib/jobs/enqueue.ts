import { createHash } from "node:crypto";
import { AppError } from "@/lib/errors/AppError";
import type { EnqueueInput, EnqueueResult, JobsAdminClient } from "@/lib/jobs/types";
import type { Json } from "@/types/database.generated";

/**
 * Idempotent raw_event + background_job enqueue.
 *
 * **Service role required:** callers must pass an admin/service-role client
 * (`createAdminClient()` in Next server paths, or an equivalent CLI client).
 * The job processor also uses the service role to claim/process jobs.
 * Authenticated UI reads go through RLS via the request-scoped client instead.
 */

function payloadHash(payload: Json): string {
  return createHash("sha256").update(JSON.stringify(payload ?? {})).digest("hex");
}

async function findExistingRawEvent(
  admin: JobsAdminClient,
  input: Pick<EnqueueInput, "agencyId" | "storeId" | "provider" | "idempotencyKey">,
) {
  let query = admin
    .from("raw_events")
    .select("id")
    .eq("agency_id", input.agencyId)
    .eq("provider", input.provider)
    .eq("idempotency_key", input.idempotencyKey);
  if (input.storeId) query = query.eq("store_id", input.storeId);
  else query = query.is("store_id", null);
  const result = await query.maybeSingle();
  if (result.error) {
    throw new AppError("DATABASE_ERROR", 500, "No se pudo consultar el evento crudo.", {
      cause: result.error,
    });
  }
  return result.data;
}

async function findExistingJob(
  admin: JobsAdminClient,
  input: Pick<EnqueueInput, "agencyId" | "storeId" | "jobType" | "idempotencyKey">,
) {
  let query = admin
    .from("background_jobs")
    .select("id")
    .eq("agency_id", input.agencyId)
    .eq("job_type", input.jobType)
    .eq("idempotency_key", input.idempotencyKey);
  if (input.storeId) query = query.eq("store_id", input.storeId);
  else query = query.is("store_id", null);
  const result = await query.maybeSingle();
  if (result.error) {
    throw new AppError("DATABASE_ERROR", 500, "No se pudo consultar el trabajo en cola.", {
      cause: result.error,
    });
  }
  return result.data;
}

function isUniqueViolation(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  if (error.code === "23505") return true;
  return (error.message ?? "").toLowerCase().includes("duplicate");
}

/**
 * Inserts a raw_event and linked background_job. On idempotency conflict,
 * returns the existing pair without creating a second job.
 */
export async function enqueueRawEventAndJob(
  adminClient: JobsAdminClient,
  input: EnqueueInput,
): Promise<EnqueueResult> {
  const existingEvent = await findExistingRawEvent(adminClient, input);
  if (existingEvent) {
    const existingJob = await findExistingJob(adminClient, input);
    if (existingJob) {
      return { rawEventId: existingEvent.id, jobId: existingJob.id, created: false };
    }
  }

  const hash = payloadHash(input.payload);
  const insertEvent = await adminClient
    .from("raw_events")
    .insert({
      agency_id: input.agencyId,
      store_id: input.storeId ?? null,
      provider: input.provider,
      integration_id: input.integrationId ?? null,
      event_type: input.eventType,
      external_event_id: input.externalEventId ?? null,
      idempotency_key: input.idempotencyKey,
      correlation_id: input.correlationId ?? null,
      payload: input.payload,
      payload_hash: hash,
      status: "received",
      max_attempts: input.maxAttempts ?? 8,
    })
    .select("id")
    .single();

  let rawEventId: string;
  if (insertEvent.error) {
    if (!isUniqueViolation(insertEvent.error)) {
      throw new AppError("DATABASE_ERROR", 500, "No se pudo registrar el evento crudo.", {
        cause: insertEvent.error,
      });
    }
    const again = await findExistingRawEvent(adminClient, input);
    if (!again) {
      throw new AppError("DATABASE_ERROR", 500, "No se pudo resolver el evento crudo duplicado.");
    }
    rawEventId = again.id;
    const existingJob = await findExistingJob(adminClient, input);
    if (existingJob) {
      return { rawEventId, jobId: existingJob.id, created: false };
    }
  } else {
    if (!insertEvent.data) {
      throw new AppError("DATABASE_ERROR", 500, "No se pudo registrar el evento crudo.");
    }
    rawEventId = insertEvent.data.id;
  }

  const insertJob = await adminClient
    .from("background_jobs")
    .insert({
      agency_id: input.agencyId,
      store_id: input.storeId ?? null,
      raw_event_id: rawEventId,
      integration_id: input.integrationId ?? null,
      queue: input.queue ?? "default",
      job_type: input.jobType,
      status: "queued",
      priority: input.priority ?? 100,
      payload: input.payload,
      idempotency_key: input.idempotencyKey,
      max_attempts: input.maxAttempts ?? 8,
      correlation_id: input.correlationId ?? null,
    })
    .select("id")
    .single();

  if (insertJob.error) {
    if (!isUniqueViolation(insertJob.error)) {
      throw new AppError("DATABASE_ERROR", 500, "No se pudo encolar el trabajo.", {
        cause: insertJob.error,
      });
    }
    const existingJob = await findExistingJob(adminClient, input);
    if (!existingJob) {
      throw new AppError("DATABASE_ERROR", 500, "No se pudo resolver el trabajo duplicado.");
    }
    return { rawEventId, jobId: existingJob.id, created: false };
  }

  if (!insertJob.data) {
    throw new AppError("DATABASE_ERROR", 500, "No se pudo encolar el trabajo.");
  }

  return { rawEventId, jobId: insertJob.data.id, created: true };
}
