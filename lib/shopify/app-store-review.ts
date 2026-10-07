/**
 * App Store review helpers.
 *
 * App charges for Store merchants: Shopify App Pricing (see docs/SHOPIFY_APP_PRICING.md).
 * Flipy wallet top-ups use Stripe for logistics and must stay hidden during app review
 * so reviewers do not confuse them with the app subscription.
 *
 * SHOPIFY_APP_REVIEW_MODE=true — hide Flipy card top-ups globally.
 * SHOPIFY_APP_REVIEW_STORE_IDS — comma-separated store UUIDs that never see wallet_topup.
 *
 * Server-only usage: call from server actions / RSC; do not expose secrets (flags only).
 */

function readTrimmed(name: string): string | undefined {
  const value = process.env[name]?.trim();
  return value || undefined;
}

export function isShopifyAppReviewMode(): boolean {
  const raw = (readTrimmed("SHOPIFY_APP_REVIEW_MODE") ?? "false").toLowerCase();
  return raw === "1" || raw === "true" || raw === "yes";
}

export function parseShopifyAppReviewStoreIds(
  raw: string | undefined = readTrimmed("SHOPIFY_APP_REVIEW_STORE_IDS"),
): Set<string> {
  if (!raw) return new Set();
  return new Set(
    raw
      .split(",")
      .map((part) => part.trim())
      .filter(Boolean),
  );
}

/** True when Flipy Stripe wallet top-up must be hidden for this store. */
export function isFlipyWalletTopupDisabledForStore(storeId: string | null | undefined): boolean {
  if (!storeId) return isShopifyAppReviewMode();
  if (isShopifyAppReviewMode()) return true;
  return parseShopifyAppReviewStoreIds().has(storeId);
}
