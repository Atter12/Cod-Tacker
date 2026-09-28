import "server-only";

import { getShopifyEnv } from "@/lib/integrations/shopify/env";
import { shopifySessionTokenExchangeBody } from "@/lib/integrations/shopify/session-token";
import type { ShopifyStoredCredentials } from "@/lib/integrations/shopify/credentials";

export function buildShopifyAuthorizeUrl(shop: string, state: string): string {
  const env = getShopifyEnv();
  const url = new URL(`https://${shop}/admin/oauth/authorize`);
  url.searchParams.set("client_id", env.clientId);
  url.searchParams.set("scope", env.scopes);
  url.searchParams.set("redirect_uri", env.redirectUri);
  url.searchParams.set("state", state);
  return url.toString();
}

export type ShopifyTokenResponse = ShopifyStoredCredentials & {
  scope: string;
};

type ShopifyTokenPayload = {
  access_token?: string;
  scope?: string;
  expires_in?: number;
  refresh_token?: string;
  refresh_token_expires_in?: number;
};

function parseShopifyTokenPayload(data: ShopifyTokenPayload): ShopifyTokenResponse {
  if (!data.access_token) {
    throw new Error("Shopify no devolvió access_token.");
  }
  const now = Date.now();
  const expiring = Boolean(data.refresh_token && data.expires_in);
  return {
    access_token: data.access_token,
    scope: data.scope ?? "",
    expiring,
    refresh_token: data.refresh_token ?? null,
    access_token_expires_at: expiring
      ? new Date(now + (data.expires_in ?? 3600) * 1000).toISOString()
      : null,
    refresh_token_expires_at:
      expiring && data.refresh_token_expires_in
        ? new Date(now + data.refresh_token_expires_in * 1000).toISOString()
        : null,
  };
}

async function postShopifyAccessToken(
  shop: string,
  body: Record<string, unknown>,
  failureLabel: string,
): Promise<ShopifyTokenResponse> {
  const res = await fetch(`https://${shop}/admin/oauth/access_token`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(body),
    cache: "no-store",
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`${failureLabel} (${res.status}): ${text.slice(0, 200)}`);
  }
  return parseShopifyTokenPayload((await res.json()) as ShopifyTokenPayload);
}

/**
 * Exchange authorization code for an offline Admin API token.
 * Always requests expiring offline tokens (required for new public apps since Apr 2026).
 * @see https://shopify.dev/docs/apps/build/authentication-authorization/access-tokens/offline-access-tokens
 */
export async function exchangeShopifyAccessToken(
  shop: string,
  code: string,
): Promise<ShopifyTokenResponse> {
  const env = getShopifyEnv();
  return postShopifyAccessToken(
    shop,
    {
      client_id: env.clientId,
      client_secret: env.clientSecret,
      code,
      expiring: 1,
    },
    "Shopify token exchange failed",
  );
}

/**
 * Embedded Admin install: App Bridge session token → offline access token.
 * The merchant stays in Shopify; there is no prior COD-tracked user.
 */
export async function exchangeShopifySessionForOfflineToken(
  shop: string,
  sessionToken: string,
): Promise<ShopifyTokenResponse> {
  const env = getShopifyEnv();
  return postShopifyAccessToken(
    shop,
    shopifySessionTokenExchangeBody({
      clientId: env.clientId,
      clientSecret: env.clientSecret,
      sessionToken,
    }),
    "Shopify session token exchange failed",
  );
}
