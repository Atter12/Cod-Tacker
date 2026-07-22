/**
 * Merge subscription metadata when applying a Stripe sync.
 * Pure — safe for unit tests.
 */
export function mergeSubscriptionBillingMetadata(input: {
  previous: Record<string, unknown>;
  status: string;
  billingInterval?: "month" | "year" | null;
  stripeEventId?: string | null;
  sourceEvent?: string | null;
  currentPeriodEnd?: string | null;
  nowIso?: string;
}): Record<string, unknown> {
  const nowIso = input.nowIso ?? new Date().toISOString();
  const next: Record<string, unknown> = {
    ...input.previous,
    stripe_event_id: input.stripeEventId ?? input.previous.stripe_event_id ?? null,
    source_event: input.sourceEvent ?? input.previous.source_event ?? null,
  };

  if (input.billingInterval) {
    next.billing_interval = input.billingInterval;
  }

  if (input.status === "past_due") {
    if (typeof next.past_due_since !== "string" || !next.past_due_since) {
      next.past_due_since = nowIso;
    }
  } else if (input.status === "active" || input.status === "trialing") {
    delete next.past_due_since;
  }

  if (input.status === "cancelled" || input.status === "expired") {
    if (typeof next.grace_period_ends_at !== "string" || !next.grace_period_ends_at) {
      const base = input.currentPeriodEnd ?? nowIso;
      next.grace_period_ends_at = new Date(
        new Date(base).getTime() + 7 * 86400000,
      ).toISOString();
    }
  }

  return next;
}
