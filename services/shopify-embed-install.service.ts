import "server-only";

import { randomBytes } from "node:crypto";
import type { ShopifyEmbedHome } from "@/lib/integrations/shopify/embed-types";
import { fetchShopifyShopInfo } from "@/lib/integrations/shopify/admin-api";
import { packShopifyCredentials } from "@/lib/integrations/shopify/credentials";
import { assertShopifyShopDomain } from "@/lib/integrations/shopify/domain";
import { loadShopifyEmbedHome } from "@/lib/integrations/shopify/embed-home";
import { exchangeShopifySessionForOfflineToken } from "@/lib/integrations/shopify/oauth";
import { registerShopifyAttributionScriptTag } from "@/lib/integrations/shopify/script-tags";
import { registerShopifyOrderWebhooks } from "@/lib/integrations/shopify/webhooks-register";
import { verifyShopifySessionToken } from "@/lib/integrations/shopify/session-token";
import { getShopifyEnv } from "@/lib/integrations/shopify/env";
import { createAdminClient } from "@/lib/supabase/admin";
import { scheduledShopifySync } from "@/services/integrations.service";
import type { Json } from "@/types/database.generated";

function shopHandle(shop: string): string {
  return shop
    .replace(/\.myshopify\.com$/i, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);
}

/**
 * Opens the embedded app the way a Shopify Admin install works:
 * session token → offline token → store linked to that shop → order sync.
 * Does not require a pre-created COD-tracked user.
 * Does not call billing limits: the installed shop is the included connector.
 */
export async function openEmbeddedShopifyShop(sessionToken: string): Promise<ShopifyEmbedHome & { shop: string }> {
  const env = getShopifyEnv();
  const session = verifyShopifySessionToken(sessionToken, {
    clientId: env.clientId,
    clientSecret: env.clientSecret,
  });
  const shop = assertShopifyShopDomain(session.shop);
  const admin = createAdminClient();

  const existing = await admin
    .from("stores")
    .select("id")
    .eq("shopify_shop_domain", shop)
    .limit(1)
    .maybeSingle();
  if (existing.error) throw new Error("No se pudo leer la tienda vinculada.");
  if (existing.data) {
    return { shop, ...(await loadShopifyEmbedHome(shop)) };
  }

  const token = await exchangeShopifySessionForOfflineToken(shop, sessionToken);
  const shopInfo = await fetchShopifyShopInfo(shop, token.access_token);
  const slug = `${shopHandle(shop) || "tienda"}-${randomBytes(3).toString("hex")}`;
  const now = new Date().toISOString();
  const name = shopInfo.name?.trim() || shop;

  const agency = await admin
    .from("agencies")
    .insert({
      name,
      slug,
      country_code: "PE",
      currency_code: shopInfo.currencyCode || "PEN",
      timezone: "America/Lima",
      is_active: true,
      settings: { shopify_connector: "free" } as Json,
    })
    .select("id")
    .single();
  if (agency.error || !agency.data) {
    throw new Error("No se pudo preparar la cuenta de esta tienda.");
  }

  const store = await admin
    .from("stores")
    .insert({
      agency_id: agency.data.id,
      name,
      slug,
      country_code: "PE",
      currency_code: shopInfo.currencyCode || "PEN",
      timezone: "America/Lima",
      shopify_shop_domain: shop,
      is_active: true,
    })
    .select("id")
    .single();
  if (store.error || !store.data) {
    await admin.from("agencies").delete().eq("id", agency.data.id);
    throw new Error("No se pudo preparar la tienda.");
  }

  const secretRef = packShopifyCredentials({
    access_token: token.access_token,
    expiring: token.expiring,
    refresh_token: token.refresh_token,
    access_token_expires_at: token.access_token_expires_at,
    refresh_token_expires_at: token.refresh_token_expires_at,
  });

  const integration = await admin
    .from("integrations")
    .insert({
      agency_id: agency.data.id,
      store_id: store.data.id,
      provider: "shopify",
      status: "connected",
      display_name: name,
      external_account_id: shopInfo.id,
      external_account_name: shopInfo.myshopifyDomain || shop,
      secret_reference: secretRef,
      scopes: token.scope.split(",").map((part) => part.trim()).filter(Boolean),
      metadata: {
        mode: "live",
        shop_domain: shop,
        origin: "shopify_admin_embed",
        currency_code: shopInfo.currencyCode,
      } as Json,
      settings: {
        shop_domain: shop,
        shopify_token_expiring: Boolean(token.expiring),
        shopify_access_token_expires_at: token.access_token_expires_at ?? null,
      } as Json,
      connected_at: now,
      connected_by: null,
      last_success_at: now,
    })
    .select("id")
    .single();
  if (integration.error || !integration.data) {
    await admin.from("stores").delete().eq("id", store.data.id);
    await admin.from("agencies").delete().eq("id", agency.data.id);
    throw new Error("No se pudo guardar la conexión Shopify.");
  }

  try {
    const registration = await registerShopifyOrderWebhooks(shop, token.access_token);
    await admin
      .from("integrations")
      .update({
        metadata: {
          mode: "live",
          shop_domain: shop,
          origin: "shopify_admin_embed",
          webhooks: { callback_uri: registration.callbackUri, registered_at: now, results: registration.results },
        } as Json,
      })
      .eq("id", integration.data.id);
  } catch {
    // OAuth-equivalent: the shop stays connected if webhook registration is rejected.
  }

  try {
    await registerShopifyAttributionScriptTag(shop, token.access_token);
  } catch {
    // Theme app embed is the preferred attribution path.
  }

  try {
    await scheduledShopifySync(admin, {
      agencyId: agency.data.id,
      storeId: store.data.id,
      syncType: "incremental",
    });
  } catch {
    // The embed still opens; the next scheduled sync can fill orders.
  }

  return { shop, ...(await loadShopifyEmbedHome(shop)) };
}
