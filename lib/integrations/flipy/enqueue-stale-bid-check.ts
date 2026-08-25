import { enqueueRawEventAndJob } from "@/lib/jobs/enqueue";
import type { JobsAdminClient } from "@/lib/jobs/types";
import type { Json } from "@/types/database.generated";

const STALE_BID_DELAY_MS = 24 * 60 * 60 * 1000;

export async function enqueueFlipyStaleBidCheck(input: {
  admin: JobsAdminClient;
  agencyId: string;
  storeId: string;
  orderId: string;
  shipmentId: string;
  externalShipmentId?: string | null;
  integrationId?: string | null;
}): Promise<{ jobId: string; created: boolean } | null> {
  const idempotencyKey = `flipy:stale-bid:${input.shipmentId}`;
  const runAt = new Date(Date.now() + STALE_BID_DELAY_MS).toISOString();
  const payload = {
    order_id: input.orderId,
    shipment_id: input.shipmentId,
    external_shipment_id: input.externalShipmentId ?? null,
    scheduled_for: runAt,
  } as Json;

  const enqueued = await enqueueRawEventAndJob(input.admin, {
    agencyId: input.agencyId,
    storeId: input.storeId,
    integrationId: input.integrationId ?? null,
    provider: "flipy",
    eventType: "flipy.bid_stale.check",
    jobType: "flipy.bid_stale.check",
    idempotencyKey,
    correlationId: input.shipmentId,
    payload,
  });

  await input.admin
    .from("background_jobs")
    .update({ run_at: runAt })
    .eq("id", enqueued.jobId);

  return { jobId: enqueued.jobId, created: enqueued.created };
}
