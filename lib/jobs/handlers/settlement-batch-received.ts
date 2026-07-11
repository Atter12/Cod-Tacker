import { z } from "zod";
import { PermanentJobError } from "@/lib/jobs/errors";
import type { JobHandler, JobHandlerResult } from "@/lib/jobs/types";
import type { Json } from "@/types/database.generated";

export const settlementBatchReceivedPayloadSchema = z.object({
  external_batch_id: z.string().min(1).max(200),
  gross_amount: z.number().nonnegative(),
  fees_amount: z.number().nonnegative().default(0),
  adjustments_amount: z.number().default(0),
  net_amount: z.number().optional(),
  currency_code: z.string().length(3).default("PEN"),
  reference: z.string().max(200).optional(),
  demo_seed: z.string().min(1).max(200).optional(),
});

function asObject(payload: Json): Record<string, unknown> {
  if (payload && typeof payload === "object" && !Array.isArray(payload)) {
    return payload as Record<string, unknown>;
  }
  throw new PermanentJobError(
    "INVALID_PAYLOAD",
    "El payload de settlement no es un objeto válido.",
  );
}

export const handleSettlementBatchReceived: JobHandler = async ({
  admin,
  job,
  payload,
}): Promise<JobHandlerResult> => {
  const parsed = settlementBatchReceivedPayloadSchema.safeParse(asObject(payload));
  if (!parsed.success) {
    throw new PermanentJobError(
      "INVALID_PAYLOAD",
      "Payload de settlement.batch.received.mock inválido.",
    );
  }
  if (!job.store_id) {
    throw new PermanentJobError("MISSING_STORE", "El trabajo de settlement requiere store_id.");
  }

  const data = parsed.data;
  const existing = await admin
    .from("settlement_batches")
    .select("id")
    .eq("store_id", job.store_id)
    .eq("external_batch_id", data.external_batch_id)
    .maybeSingle();
  if (existing.data) {
    return {
      ok: true,
      action: "skipped",
      entityType: "settlement_batch",
      entityId: existing.data.id,
      detail: "duplicate_external_batch_id",
    };
  }

  if (data.demo_seed) {
    const bySeed = await admin
      .from("settlement_batches")
      .select("id")
      .eq("store_id", job.store_id)
      .contains("metadata", { demo_seed: data.demo_seed })
      .maybeSingle();
    if (bySeed.data) {
      return {
        ok: true,
        action: "skipped",
        entityType: "settlement_batch",
        entityId: bySeed.data.id,
        detail: "duplicate_demo_seed",
      };
    }
  }

  const net =
    data.net_amount ?? data.gross_amount - data.fees_amount + data.adjustments_amount;
  const insert = await admin
    .from("settlement_batches")
    .insert({
      agency_id: job.agency_id,
      store_id: job.store_id,
      external_batch_id: data.external_batch_id,
      currency_code: data.currency_code,
      gross_amount: data.gross_amount,
      fees_amount: data.fees_amount,
      adjustments_amount: data.adjustments_amount,
      net_amount: net,
      reference: data.reference ?? data.external_batch_id,
      status: "open",
      metadata: {
        demo: true,
        demo_seed: data.demo_seed ?? null,
        job_id: job.id,
      } as Json,
    })
    .select("id")
    .single();
  if (insert.error || !insert.data) {
    if (insert.error?.code === "23505") {
      const again = await admin
        .from("settlement_batches")
        .select("id")
        .eq("store_id", job.store_id)
        .eq("external_batch_id", data.external_batch_id)
        .maybeSingle();
      if (again.data) {
        return {
          ok: true,
          action: "skipped",
          entityType: "settlement_batch",
          entityId: again.data.id,
          detail: "race_duplicate",
        };
      }
    }
    throw new PermanentJobError("DATABASE_ERROR", "No se pudo crear el lote de liquidación mock.");
  }

  return {
    ok: true,
    action: "created",
    entityType: "settlement_batch",
    entityId: insert.data.id,
  };
};
