import "server-only";

import { normalizeShopifyAppGid } from "@/lib/billing/shopify-gids";

export { normalizeShopifyAppGid, normalizeShopifyShopGid } from "@/lib/billing/shopify-gids";

/**
 * Partner API credentials for Shopify App Pricing subscription sync.
 *
 *   SHOPIFY_PARTNER_ORG_ID       — numeric org id from partners.shopify.com/{id}/…
 *   SHOPIFY_PARTNER_API_TOKEN    — Partner API client access token (Manage apps)
 *   SHOPIFY_APP_GID              — gid://shopify/App/{id} (or numeric app id)
 *   SHOPIFY_PARTNER_API_VERSION  — default 2026-07
 */

function readTrimmed(name: string): string | null {
  const raw = process.env[name];
  if (typeof raw === "string" && raw.trim()) return raw.trim();
  return null;
}

export type ShopifyPartnerEnv = {
  orgId: string;
  accessToken: string;
  appGid: string;
  apiVersion: string;
};

export function getShopifyPartnerEnv(): ShopifyPartnerEnv | null {
  const orgId = readTrimmed("SHOPIFY_PARTNER_ORG_ID");
  const accessToken = readTrimmed("SHOPIFY_PARTNER_API_TOKEN");
  const appRaw = readTrimmed("SHOPIFY_APP_GID");
  if (!orgId || !accessToken || !appRaw) return null;
  try {
    return {
      orgId,
      accessToken,
      appGid: normalizeShopifyAppGid(appRaw),
      apiVersion: readTrimmed("SHOPIFY_PARTNER_API_VERSION") ?? "2026-07",
    };
  } catch {
    return null;
  }
}

export function isShopifyPartnerApiConfigured(): boolean {
  return getShopifyPartnerEnv() !== null;
}

export function assertShopifyPartnerEnv(): ShopifyPartnerEnv {
  const env = getShopifyPartnerEnv();
  if (!env) {
    throw new Error(
      "Falta Partner API: SHOPIFY_PARTNER_ORG_ID, SHOPIFY_PARTNER_API_TOKEN y SHOPIFY_APP_GID.",
    );
  }
  return env;
}

export function shopifyPartnerGraphqlUrl(env: ShopifyPartnerEnv = assertShopifyPartnerEnv()): string {
  return `https://partners.shopify.com/${env.orgId}/api/${env.apiVersion}/graphql.json`;
}
