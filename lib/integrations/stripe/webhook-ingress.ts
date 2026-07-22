import "server-only";

import type Stripe from "stripe";
import {
  billingWebhookIdempotencyKey,
  classifyBillingWebhookClaim,
  isHandledStripeBillingEvent,
} from "@/lib/integrations/stripe/webhook-idempotency";
import { enqueueRawEventAndJob } from "@/lib/jobs/enqueue";
import { logger } from "@/lib/observability/logger";
import { constructStripeWebhookEvent } from "@/lib/integrations/stripe/webhook-auth";
import {
  extractAgencyIdFromCheckoutSession,
  normalizeStripeInvoice,
  normalizeStripeSubscription,
} from "@/lib/integrations/stripe/normalize";
import { getStripeClient } from "@/lib/integrations/stripe/client";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Json } from "@/types/database.generated";

async function resolveAgencyIdFromCustomer(
  customerId: string | null,
): Promise<string | null> {
  if (!customerId) return null;
  const admin = createAdminClient();
  const { data } = await admin
    .from("subscriptions")
    .select("agency_id")
    .eq("provider_customer_id", customerId)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data?.agency_id ?? null;
}

async function claimWebhookEvent(input: {
  eventId: string;
  eventType: string;
  agencyId: string | null;
  summary: Record<string, unknown>;
}): Promise<"claimed" | "duplicate"> {
  const admin = createAdminClient();
  const insert = await admin.from("billing_webhook_events").insert({
    provider: "stripe",
    event_id: input.eventId,
    event_type: input.eventType,
    agency_id: input.agencyId,
    payload_summary: input.summary as Json,
  });
  return classifyBillingWebhookClaim(insert.error);
}

async function markWebhookProcessed(eventId: string): Promise<void> {
  const admin = createAdminClient();
  await admin
    .from("billing_webhook_events")
    .update({ processed_at: new Date().toISOString() })
    .eq("provider", "stripe")
    .eq("event_id", eventId);
}

/**
 * Stripe billing webhook ingress.
 * Verifies signature → idempotent claim → enqueue normalized billing jobs.
 */
export async function handleStripeBillingWebhookIngress(input: {
  rawBody: string;
  signatureHeader: string | null;
}): Promise<{ status: number; body: Record<string, unknown>; enqueued?: boolean }> {
  const auth = constructStripeWebhookEvent(input);
  if (!auth.ok) {
    logger.warn("stripe.billing.webhook.rejected", {
      status: auth.status,
      error: auth.error,
    });
    return { status: auth.status, body: { error: auth.error } };
  }

  const event = auth.event;
  if (!isHandledStripeBillingEvent(event.type)) {
    return {
      status: 200,
      enqueued: false,
      body: { ok: true, ignored: true, type: event.type },
    };
  }

  const admin = createAdminClient();
  let agencyId: string | null = null;
  let jobType: "billing.subscription.updated" | "billing.invoice.upserted" | null = null;
  let payload: Record<string, unknown> | null = null;

  try {
    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;
      agencyId = extractAgencyIdFromCheckoutSession(session);
      const subId =
        typeof session.subscription === "string"
          ? session.subscription
          : session.subscription?.id ?? null;
      if (subId) {
        const stripe = getStripeClient();
        const sub = await stripe.subscriptions.retrieve(subId, {
          expand: ["customer"],
        });
        const normalized = await normalizeStripeSubscription(sub, agencyId);
        if (normalized) {
          agencyId = normalized.agencyId;
          jobType = "billing.subscription.updated";
          payload = { ...normalized, source_event: event.type, stripe_event_id: event.id };
        }
      }
    } else if (
      event.type === "customer.subscription.created" ||
      event.type === "customer.subscription.updated" ||
      event.type === "customer.subscription.deleted"
    ) {
      const sub = event.data.object as Stripe.Subscription;
      const customerId = typeof sub.customer === "string" ? sub.customer : sub.customer?.id ?? null;
      agencyId =
        (await normalizeStripeSubscription(sub, null))?.agencyId ??
        (await resolveAgencyIdFromCustomer(customerId));
      const normalized = await normalizeStripeSubscription(sub, agencyId);
      if (normalized) {
        agencyId = normalized.agencyId;
        if (event.type === "customer.subscription.deleted") {
          normalized.status = "cancelled";
        }
        jobType = "billing.subscription.updated";
        payload = { ...normalized, source_event: event.type, stripe_event_id: event.id };
      }
    } else if (
      event.type === "invoice.paid" ||
      event.type === "invoice.finalized" ||
      event.type === "invoice.payment_failed"
    ) {
      const invoice = event.data.object as Stripe.Invoice;
      const customerId =
        typeof invoice.customer === "string" ? invoice.customer : invoice.customer?.id ?? null;
      agencyId = await resolveAgencyIdFromCustomer(customerId);
      const normalized = await normalizeStripeInvoice(invoice, agencyId);
      if (normalized) {
        agencyId = normalized.agencyId;
        jobType = "billing.invoice.upserted";
        payload = {
          ...normalized,
          source_event: event.type,
          stripe_event_id: event.id,
          mark_past_due: event.type === "invoice.payment_failed",
        };
      }
    }
  } catch (error) {
    logger.error("stripe.billing.webhook.normalize_failed", {
      event_id: event.id,
      type: event.type,
      error: error instanceof Error ? error.message : "unknown",
    });
    return { status: 500, body: { error: "normalize_failed" } };
  }

  if (!agencyId || !jobType || !payload) {
    logger.warn("stripe.billing.webhook.unresolved_agency", {
      event_id: event.id,
      type: event.type,
    });
    await claimWebhookEvent({
      eventId: event.id,
      eventType: event.type,
      agencyId: null,
      summary: { unresolved: true, type: event.type },
    });
    return {
      status: 200,
      enqueued: false,
      body: { ok: true, unresolved_agency: true },
    };
  }

  const claim = await claimWebhookEvent({
    eventId: event.id,
    eventType: event.type,
    agencyId,
    summary: { type: event.type, jobType },
  });
  if (claim === "duplicate") {
    return {
      status: 200,
      enqueued: false,
      body: { ok: true, duplicate: true },
    };
  }

  const enqueued = await enqueueRawEventAndJob(admin, {
    agencyId,
    storeId: null,
    provider: "custom_payment",
    eventType: jobType,
    jobType,
    idempotencyKey: billingWebhookIdempotencyKey(event.id),
    externalEventId: event.id,
    payload: payload as Json,
    queue: "billing",
    priority: 50,
  });

  await markWebhookProcessed(event.id);

  return {
    status: 200,
    enqueued: enqueued.created,
    body: {
      ok: true,
      enqueued: enqueued.created,
      jobId: enqueued.jobId,
      jobType,
      duplicate_job: !enqueued.created,
    },
  };
}
