/**
 * App Store review helpers.
 *
 * App charges for Store merchants: Shopify App Pricing (see docs/SHOPIFY_APP_PRICING.md).
 * Logistics top-up opens Flipy's own recarga page (partner token, top window). The card
 * form is not inside the embedded app, so review mode does not hide that handoff.
 *
 * SHOPIFY_APP_REVIEW_STORE_IDS — comma-separated store UUIDs that never open wallet_topup
 * (demo accounts). SHOPIFY_APP_REVIEW_MODE does not hide the Flipy handoff.
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

/** True when this demo store must not open the Flipy logistics top-up. */
export function isFlipyWalletTopupDisabledForStore(storeId: string | null | undefined): boolean {
  if (!storeId) return false;
  return parseShopifyAppReviewStoreIds().has(storeId);
}
