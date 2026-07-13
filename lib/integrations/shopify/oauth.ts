import "server-only";

import { getShopifyEnv } from "@/lib/integrations/shopify/env";

export function buildShopifyAuthorizeUrl(shop: string, state: string): string {
  const env = getShopifyEnv();
  const url = new URL(`https://${shop}/admin/oauth/authorize`);
  url.searchParams.set("client_id", env.clientId);
  url.searchParams.set("scope", env.scopes);
  url.searchParams.set("redirect_uri", env.redirectUri);
  url.searchParams.set("state", state);
  return url.toString();
}

export type ShopifyTokenResponse = {
  access_token: string;
  scope: string;
};

export async function exchangeShopifyAccessToken(
  shop: string,
  code: string,
): Promise<ShopifyTokenResponse> {
  const env = getShopifyEnv();
  const res = await fetch(`https://${shop}/admin/oauth/access_token`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({
      client_id: env.clientId,
      client_secret: env.clientSecret,
      code,
    }),
    cache: "no-store",
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Shopify token exchange failed (${res.status}): ${text.slice(0, 200)}`);
  }

  const data = (await res.json()) as Partial<ShopifyTokenResponse>;
  if (!data.access_token) {
    throw new Error("Shopify no devolvió access_token.");
  }
  return {
    access_token: data.access_token,
    scope: data.scope ?? "",
  };
}
