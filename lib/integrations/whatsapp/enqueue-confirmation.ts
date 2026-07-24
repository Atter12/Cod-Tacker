import "server-only";

import { enqueueRawEventAndJob } from "@/lib/jobs/enqueue";
import { kickJobProcessing } from "@/lib/jobs/kick";
import type { JobsAdminClient } from "@/lib/jobs/types";
import type { Json } from "@/types/database.generated";

export type WhatsappCodConfirmationSource =
  | "shopify_create"
  | "shopify_duplicate_repair"
  | "manual";

/**
 * Proven send path (same as the order-detail retry button):
 * fresh idempotency key + optional immediate job kick.
 *
 * Dedupes by order state: only `not_requested` unless `allowPendingResend`.
 * Does not re-send when confirmation is already confirmed/rejected.
 */
export async function enqueueWhatsappCodConfirmationRequest(input: {
  admin: JobsAdminClient;
  agencyId: string;
  storeId: string;
  orderId: string;
  source: WhatsappCodConfirmationSource;
  /** Shopify or WhatsApp integration id — handler resolves WhatsApp by provider. */
  integrationId?: string | null;
  allowPendingResend?: boolean;
  actorId?: string | null;
  demoSeed?: string | null;
  /** Kick the worker so the template sends without waiting for cron. */
  kick?: boolean;
}): Promise<{ jobId: string; created: boolean; skipped?: string } | null> {
  const order = await input.admin
    .from("orders")
    .select("id, payment_status, confirmation_status")
    .eq("id", input.orderId)
    .eq("store_id", input.storeId)
    .maybeSingle();

  if (!order.data) return null;
  if (order.data.payment_status !== "cash_expected") {
    return { jobId: "", created: false, skipped: "not_cash_expected" };
  }
  if (
    order.data.confirmation_status === "confirmed" ||
    order.data.confirmation_status === "rejected"
  ) {
    return { jobId: "", created: false, skipped: "confirmation_terminal" };
  }
  if (
    order.data.confirmation_status === "pending" &&
    !input.allowPendingResend
  ) {
    return { jobId: "", created: false, skipped: "already_pending" };
  }

  let integrationId = input.integrationId ?? null;
  if (!integrationId) {
    const wa = await input.admin
      .from("integrations")
      .select("id")
      .eq("store_id", input.storeId)
      .eq("provider", "whatsapp")
      .in("status", ["connected", "pending", "degraded", "error"])
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    integrationId = wa.data?.id ?? null;
  }

  const enqueued = await enqueueRawEventAndJob(input.admin, {
    agencyId: input.agencyId,
    storeId: input.storeId,
    integrationId,
    provider: "whatsapp",
    eventType: "whatsapp.confirmation.request",
    jobType: "whatsapp.confirmation.request",
    idempotencyKey: `wa-confirm-send:${input.orderId}:${input.source}:${Date.now()}`,
    correlationId: input.orderId,
    payload: {
      order_id: input.orderId,
      source: input.source,
      ...(input.demoSeed ? { demo_seed: input.demoSeed } : {}),
      ...(input.actorId ? { requested_by: input.actorId } : {}),
    } as Json,
  });

  if (input.kick !== false) {
    // Must await: a fire-and-forget `void kick` is often frozen on serverless
    // when the parent Shopify webhook `after()` batch ends — WA stays queued
    // and confirmation_status remains `not_requested` until a manual retry.
    await kickJobProcessing({
      limit: 8,
      reason: `whatsapp-confirmation:${input.source}`,
    });
  }

  return { jobId: enqueued.jobId, created: enqueued.created };
}
