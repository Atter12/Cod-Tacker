export type ShopifySubscriptionSyncDecision =
  | { sync: true }
  | { sync: false; reason: string };

/**
 * Shopify App Pricing may fill an empty or demo subscription.
 * It must not replace an active Stripe (or other paid) subscription.
 */
export function decideShopifySubscriptionSync(
  billingProvider: string | null | undefined,
): ShopifySubscriptionSyncDecision {
  if (
    billingProvider &&
    billingProvider !== "shopify" &&
    billingProvider !== "demo"
  ) {
    return { sync: false, reason: `agency_uses_${billingProvider}` };
  }
  return { sync: true };
}
