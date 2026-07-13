import "server-only";

import { getShopifyEnv } from "@/lib/integrations/shopify/env";

export type ShopifyShopInfo = {
  id: string;
  name: string;
  myshopifyDomain: string;
  email: string | null;
  currencyCode: string | null;
};

export async function fetchShopifyShopInfo(
  shop: string,
  accessToken: string,
): Promise<ShopifyShopInfo> {
  const { apiVersion } = getShopifyEnv();
  const res = await fetch(`https://${shop}/admin/api/${apiVersion}/graphql.json`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Shopify-Access-Token": accessToken,
    },
    body: JSON.stringify({
      query: `#graphql
        query ShopConnectionTest {
          shop {
            id
            name
            myshopifyDomain
            email
            currencyCode
          }
        }
      `,
    }),
    cache: "no-store",
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Shopify GraphQL failed (${res.status}): ${text.slice(0, 200)}`);
  }

  const json = (await res.json()) as {
    data?: { shop?: ShopifyShopInfo };
    errors?: Array<{ message: string }>;
  };

  if (json.errors?.length) {
    throw new Error(json.errors.map((e) => e.message).join("; "));
  }
  if (!json.data?.shop) {
    throw new Error("Shopify GraphQL no devolvió datos de la tienda.");
  }
  return json.data.shop;
}
