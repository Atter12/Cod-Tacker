import type { Enums } from "@/types/database.generated";

export type DomainSubscriptionStatus = Enums<"subscription_status">;

/**
 * Maps Stripe Subscription.status → CODTracked subscription_status.
 * Unknown values fall through to past_due (safe / restrictive).
 */
export function mapStripeSubscriptionStatus(
  stripeStatus: string | null | undefined,
): DomainSubscriptionStatus {
  switch (stripeStatus) {
    case "trialing":
      return "trialing";
    case "active":
      return "active";
    case "past_due":
      return "past_due";
    case "paused":
      return "paused";
    case "canceled":
      return "cancelled";
    case "unpaid":
    case "incomplete_expired":
      return "expired";
    case "incomplete":
      return "past_due";
    default:
      return "past_due";
  }
}

export type NormalizedBillingSubscription = {
  agencyId: string;
  planCode: string | null;
  status: DomainSubscriptionStatus;
  providerCustomerId: string | null;
  providerSubscriptionId: string;
  cancelAtPeriodEnd: boolean;
  currentPeriodStart: string | null;
  currentPeriodEnd: string | null;
  trialEndsAt: string | null;
  billingInterval: "month" | "year" | null;
};

export function unixToIso(seconds: number | null | undefined): string | null {
  if (seconds == null || !Number.isFinite(seconds)) return null;
  return new Date(seconds * 1000).toISOString();
}
