import "server-only";

import { z } from "zod";
import { getPublicEnv } from "@/config/env";

const shopifyEnvSchema = z.object({
  SHOPIFY_CLIENT_ID: z.string().trim().min(1),
  SHOPIFY_CLIENT_SECRET: z.string().trim().min(1),
  SHOPIFY_APP_URL: z.string().url().optional(),
  SHOPIFY_REDIRECT_URI: z.string().url().optional(),
  SHOPIFY_API_VERSION: z.string().trim().min(1).default("2026-07"),
  SHOPIFY_SCOPES: z
    .string()
    .trim()
    .min(1)
    .default(
      "read_orders,read_customers,read_products,read_fulfillments,read_locations,write_script_tags",
    ),
});

export type ShopifyEnv = {
  clientId: string;
  clientSecret: string;
  appUrl: string;
  redirectUri: string;
  apiVersion: string;
  scopes: string;
};

export function getShopifyEnv(): ShopifyEnv {
  const publicEnv = getPublicEnv();
  const parsed = shopifyEnvSchema.parse({
    SHOPIFY_CLIENT_ID: process.env.SHOPIFY_CLIENT_ID,
    SHOPIFY_CLIENT_SECRET: process.env.SHOPIFY_CLIENT_SECRET,
    SHOPIFY_APP_URL: process.env.SHOPIFY_APP_URL,
    SHOPIFY_REDIRECT_URI: process.env.SHOPIFY_REDIRECT_URI,
    SHOPIFY_API_VERSION: process.env.SHOPIFY_API_VERSION,
    SHOPIFY_SCOPES: process.env.SHOPIFY_SCOPES,
  });

  const appUrl = (parsed.SHOPIFY_APP_URL ?? publicEnv.NEXT_PUBLIC_APP_URL).replace(/\/$/, "");
  const redirectUri =
    parsed.SHOPIFY_REDIRECT_URI ?? `${appUrl}/api/integrations/shopify/callback`;

  return {
    clientId: parsed.SHOPIFY_CLIENT_ID,
    clientSecret: parsed.SHOPIFY_CLIENT_SECRET,
    appUrl,
    redirectUri,
    apiVersion: parsed.SHOPIFY_API_VERSION,
    scopes: parsed.SHOPIFY_SCOPES.split(",")
      .map((s) => s.trim())
      .filter(Boolean)
      .join(","),
  };
}

export function isShopifyConfigured(): boolean {
  try {
    getShopifyEnv();
    return true;
  } catch {
    return false;
  }
}
