/**
 * Pure helpers for Stripe billing webhook idempotency (unit-testable).
 */

export function billingWebhookIdempotencyKey(stripeEventId: string): string {
  return `stripe:${stripeEventId.trim()}`;
}

export function isBillingWebhookUniqueViolation(error: {
  code?: string;
  message?: string;
} | null): boolean {
  if (!error) return false;
  if (error.code === "23505") return true;
  return (error.message ?? "").toLowerCase().includes("duplicate");
}

export function classifyBillingWebhookClaim(
  insertError: { code?: string; message?: string } | null,
): "claimed" | "duplicate" {
  if (!insertError) return "claimed";
  if (isBillingWebhookUniqueViolation(insertError)) return "duplicate";
  throw insertError;
}

export const STRIPE_BILLING_HANDLED_EVENT_TYPES = [
  "checkout.session.completed",
  "customer.subscription.created",
  "customer.subscription.updated",
  "customer.subscription.deleted",
  "invoice.paid",
  "invoice.finalized",
  "invoice.payment_failed",
] as const;

export type StripeBillingHandledEventType =
  (typeof STRIPE_BILLING_HANDLED_EVENT_TYPES)[number];

export function isHandledStripeBillingEvent(type: string): boolean {
  return (STRIPE_BILLING_HANDLED_EVENT_TYPES as readonly string[]).includes(type);
}

/** Job type for a Stripe event (after normalize). */
export function stripeEventToBillingJobType(
  type: string,
): "billing.subscription.updated" | "billing.invoice.upserted" | null {
  if (
    type === "checkout.session.completed" ||
    type === "customer.subscription.created" ||
    type === "customer.subscription.updated" ||
    type === "customer.subscription.deleted"
  ) {
    return "billing.subscription.updated";
  }
  if (
    type === "invoice.paid" ||
    type === "invoice.finalized" ||
    type === "invoice.payment_failed"
  ) {
    return "billing.invoice.upserted";
  }
  return null;
}
