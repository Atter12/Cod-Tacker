import type { BillingInterval } from "@/lib/integrations/contracts/billing";
import { shopifyHandleToPlanCode } from "@/lib/billing/shopify-plans";
import type { Enums } from "@/types/database.generated";

/**
 * One AppSubscription from the Admin API
 * (`currentAppInstallation.activeSubscriptions`), read with the shop's own token.
 */
export type ShopifyAppSubscriptionSnapshot = {
  id: string;
  /** Plan name shown on Shopify's pricing page (Starter / Growth / Scale). */
  name: string;
  /** ACTIVE | FROZEN | PENDING | ACCEPTED | CANCELLED | DECLINED | EXPIRED */
  status: string;
  createdAt: string | null;
  currentPeriodEnd: string | null;
  trialDays: number | null;
  /** AppPricingInterval of the recurring line item (EVERY_30_DAYS | ANNUAL). */
  interval: string | null;
};

export type MappedShopifySubscription = {
  status: Enums<"subscription_status">;
  planCode: string | null;
  billingInterval: BillingInterval | null;
  cancelAtPeriodEnd: boolean;
  currentPeriodStart: string | null;
  currentPeriodEnd: string | null;
  trialEndsAt: string | null;
  providerSubscriptionId: string;
};

/** Map AppPricingInterval → local billing interval. */
export function mapShopifyBillingPeriod(
  billingPeriod: string | null | undefined,
): BillingInterval | null {
  if (!billingPeriod) return null;
  const value = billingPeriod.trim().toUpperCase();
  if (
    value === "ANNUAL" ||
    value === "EVERY_365_DAYS" ||
    value === "YEAR" ||
    value === "YEARLY"
  ) {
    return "year";
  }
  if (
    value === "EVERY_30_DAYS" ||
    value === "MONTHLY" ||
    value === "MONTH" ||
    value === "EVERY_30_DAY"
  ) {
    return "month";
  }
  return null;
}

/**
 * App Pricing exposes the plan by its display name, not its handle.
 * "Growth", " growth ", "Plan Growth" → growth (handles default to the plan codes).
 */
export function shopifyPlanNameToPlanCode(name: string | null | undefined): string | null {
  const normalized = (name ?? "").trim().toLowerCase().replace(/^plan\s+/, "");
  if (!normalized) return null;
  return shopifyHandleToPlanCode(normalized);
}

/** Statuses that keep the app paid: ACTIVE, and FROZEN (store on hold, Shopify retries). */
const PAID_STATUSES = ["ACTIVE", "FROZEN"] as const;

/** The subscription that decides the plan: ACTIVE first, then FROZEN. */
export function pickCurrentAppSubscription(
  subscriptions: readonly ShopifyAppSubscriptionSnapshot[],
): ShopifyAppSubscriptionSnapshot | null {
  for (const status of PAID_STATUSES) {
    const match = subscriptions.find((sub) => sub.status.toUpperCase() === status);
    if (match) return match;
  }
  return null;
}

function addDaysIso(iso: string, days: number): string | null {
  const start = Date.parse(iso);
  if (!Number.isFinite(start)) return null;
  return new Date(start + days * 86_400_000).toISOString();
}

export function mapShopifyAppSubscription(
  snapshot: ShopifyAppSubscriptionSnapshot,
  input: { now?: Date } = {},
): MappedShopifySubscription {
  const now = input.now ?? new Date();
  const trialEndsAt =
    snapshot.trialDays && snapshot.trialDays > 0 && snapshot.createdAt
      ? addDaysIso(snapshot.createdAt, snapshot.trialDays)
      : null;
  const trialActive = trialEndsAt !== null && Date.parse(trialEndsAt) > now.getTime();
  const frozen = snapshot.status.toUpperCase() === "FROZEN";

  return {
    status: frozen ? "past_due" : trialActive ? "trialing" : "active",
    planCode: shopifyPlanNameToPlanCode(snapshot.name),
    billingInterval: mapShopifyBillingPeriod(snapshot.interval),
    // The Admin API has no "cancel at end of cycle" flag; cancelling ends the subscription.
    cancelAtPeriodEnd: false,
    currentPeriodStart: null,
    currentPeriodEnd: snapshot.currentPeriodEnd,
    trialEndsAt,
    providerSubscriptionId: snapshot.id,
  };
}
