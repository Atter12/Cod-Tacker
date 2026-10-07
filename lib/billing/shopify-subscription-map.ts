import type { BillingInterval } from "@/lib/integrations/contracts/billing";
import { shopifyHandleToPlanCode } from "@/lib/billing/shopify-plans";
import type { Enums } from "@/types/database.generated";

export type ShopifyActiveSubscriptionSnapshot = {
  billingPeriod: string | null;
  cancelAtEndOfCycle: boolean;
  trialEndsAt: string | null;
  currentBillingCycle: { startTime: string | null; endTime: string | null } | null;
  items: Array<{ handle: string | null }>;
  pendingUpdate: { items: Array<{ handle: string | null }> } | null;
  legacySubscriptionId: string | null;
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

/** Map Partner AppPricingInterval → local billing interval. */
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

export function pickShopifyPlanHandle(
  snapshot: Pick<ShopifyActiveSubscriptionSnapshot, "items" | "pendingUpdate">,
): string | null {
  for (const item of snapshot.items) {
    const handle = item.handle?.trim();
    if (handle) return handle;
  }
  for (const item of snapshot.pendingUpdate?.items ?? []) {
    const handle = item.handle?.trim();
    if (handle) return handle;
  }
  return null;
}

export function mapShopifyActiveSubscription(
  snapshot: ShopifyActiveSubscriptionSnapshot,
  input: { shopGid: string; now?: Date } = { shopGid: "" },
): MappedShopifySubscription {
  const now = input.now ?? new Date();
  const trialEndsAt = snapshot.trialEndsAt;
  const trialActive =
    Boolean(trialEndsAt) && Number.isFinite(Date.parse(trialEndsAt!)) && Date.parse(trialEndsAt!) > now.getTime();

  const planHandle = pickShopifyPlanHandle(snapshot);
  const planCode = planHandle ? shopifyHandleToPlanCode(planHandle) : null;

  const providerSubscriptionId =
    snapshot.legacySubscriptionId?.trim() ||
    `shopify-app-pricing:${input.shopGid || "unknown"}`;

  return {
    status: trialActive ? "trialing" : "active",
    planCode,
    billingInterval: mapShopifyBillingPeriod(snapshot.billingPeriod),
    cancelAtPeriodEnd: Boolean(snapshot.cancelAtEndOfCycle),
    currentPeriodStart: snapshot.currentBillingCycle?.startTime ?? null,
    currentPeriodEnd: snapshot.currentBillingCycle?.endTime ?? null,
    trialEndsAt,
    providerSubscriptionId,
  };
}
