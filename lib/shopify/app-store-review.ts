/**
 * App Store review helpers (policy 1.2.1).
 * Keeps Shopify listing as a Free connector while SaaS billing stays on the agency panel.
 *
 * SHOPIFY_APP_REVIEW_MODE=true — hide Flipy card top-ups globally (review deploys).
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
