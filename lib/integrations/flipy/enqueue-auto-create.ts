import "server-only";

import { enqueueRawEventAndJob } from "@/lib/jobs/enqueue";
import type { JobsAdminClient } from "@/lib/jobs/types";
import type { Json } from "@/types/database.generated";

export async function enqueueFlipyAutoCreateShipment(input: {
  admin: JobsAdminClient;
  agencyId: string;
  storeId: string;
  orderId: string;
  integrationId?: string | null;
}): Promise<{ jobId: string; created: boolean } | null> {
  const idempotencyKey = `flipy:auto-create:${input.orderId}`;
  const payload = {
    order_id: input.orderId,
  } as Json;

  const enqueued = await enqueueRawEventAndJob(input.admin, {
    agencyId: input.agencyId,
    storeId: input.storeId,
    integrationId: input.integrationId ?? null,
    provider: "flipy",
    eventType: "flipy.auto_create.shipment",
    jobType: "flipy.auto_create.shipment",
    idempotencyKey,
    correlationId: input.orderId,
    payload,
  });

  return { jobId: enqueued.jobId, created: enqueued.created };
}
