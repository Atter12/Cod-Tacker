import "server-only";

import { isEncryptedSecretRef } from "@/lib/crypto/secret-box";
import { fetchShopifyShopInfo } from "@/lib/integrations/shopify/admin-api";
import {
  ensureShopifyAccessToken,
  packShopifyCredentials,
} from "@/lib/integrations/shopify/credentials";
import { assertShopifyShopDomain } from "@/lib/integrations/shopify/domain";
import { exchangeShopifyAccessToken } from "@/lib/integrations/shopify/oauth";
import type { ShopifyOAuthStatePayload } from "@/lib/integrations/shopify/oauth-state";
import { registerShopifyAttributionScriptTag } from "@/lib/integrations/shopify/script-tags";
import { registerShopifyOrderWebhooks } from "@/lib/integrations/shopify/webhooks-register";
import { throwQueryError, type DatabaseClient } from "@/services/_shared";
import type { Enums, Json } from "@/types/database.generated";
import type { IntegrationRow } from "@/types/database";

function asMetaRecord(metadata: IntegrationRow["metadata"]): Record<string, unknown> {
  if (typeof metadata === "object" && metadata && !Array.isArray(metadata)) {
    return { ...(metadata as Record<string, unknown>) };
  }
  return {};
}

export async function completeShopifyOAuth(
  client: DatabaseClient,
  input: {
    state: ShopifyOAuthStatePayload;
    shop: string;
    code: string;
  },
): Promise<IntegrationRow> {
  const shop = assertShopifyShopDomain(input.shop);
  if (shop !== input.state.shop) {
    throw new Error("El dominio de la tienda no coincide con el inicio OAuth.");
  }

  const token = await exchangeShopifyAccessToken(shop, input.code);
  const shopInfo = await fetchShopifyShopInfo(shop, token.access_token);
  const secretRef = packShopifyCredentials({
    access_token: token.access_token,
    expiring: token.expiring,
    refresh_token: token.refresh_token,
    access_token_expires_at: token.access_token_expires_at,
    refresh_token_expires_at: token.refresh_token_expires_at,
  });
  const scopes = token.scope
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const now = new Date().toISOString();

  const existing = await client
    .from("integrations")
    .select("*")
    .eq("agency_id", input.state.agencyId)
    .eq("store_id", input.state.storeId)
    .eq("provider", "shopify")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  throwQueryError(existing.error);

  const payload = {
    agency_id: input.state.agencyId,
    store_id: input.state.storeId,
    provider: "shopify" as Enums<"integration_provider">,
    status: "connected" as const,
    display_name: shopInfo.name || "Shopify",
    external_account_id: shopInfo.id,
    external_account_name: shopInfo.myshopifyDomain || shop,
    secret_reference: secretRef,
    scopes,
    metadata: {
      mode: "live",
      shop_domain: shop,
      currency_code: shopInfo.currencyCode,
      shop_email: shopInfo.email,
      shopify_token_expiring: Boolean(token.expiring),
    } as Json,
    settings: {
      shop_domain: shop,
      shopify_token_expiring: Boolean(token.expiring),
      shopify_access_token_expires_at: token.access_token_expires_at ?? null,
    } as Json,
    connected_at: now,
    connected_by: input.state.userId,
    last_success_at: now,
    last_error_at: null,
    last_error_message: null,
  };

  let row: IntegrationRow;
  if (existing.data) {
    const updated = await client
      .from("integrations")
      .update(payload)
      .eq("id", existing.data.id)
      .eq("agency_id", input.state.agencyId)
      .eq("store_id", input.state.storeId)
      .select()
      .single();
    throwQueryError(updated.error);
    if (!updated.data) throw new Error("No se pudo actualizar la integración Shopify.");
    row = updated.data;
  } else {
    const inserted = await client.from("integrations").insert(payload).select().single();
    throwQueryError(inserted.error);
    if (!inserted.data) throw new Error("No se pudo crear la integración Shopify.");
    row = inserted.data;
  }

  await client
    .from("stores")
    .update({ shopify_shop_domain: shop, updated_at: now })
    .eq("id", input.state.storeId)
    .eq("agency_id", input.state.agencyId);

  // Register HTTPS order webhooks (soft-fail: OAuth remains valid if Shopify rejects topics).
  try {
    const registration = await registerShopifyOrderWebhooks(shop, token.access_token);
    const webhookMeta = {
      ...asMetaRecord(row.metadata),
      mode: "live",
      shop_domain: shop,
      webhooks: {
        callback_uri: registration.callbackUri,
        registered_at: new Date().toISOString(),
        results: registration.results,
      },
    } as Json;
    const patched = await client
      .from("integrations")
      .update({ metadata: webhookMeta })
      .eq("id", row.id)
      .eq("store_id", input.state.storeId)
      .select()
      .single();
    throwQueryError(patched.error);
    if (patched.data) row = patched.data;
  } catch (err) {
    const webhookMeta = {
      ...asMetaRecord(row.metadata),
      mode: "live",
      shop_domain: shop,
      webhooks: {
        registered_at: new Date().toISOString(),
        error: err instanceof Error ? err.message.slice(0, 300) : "webhook_register_failed",
      },
    } as Json;
    const patched = await client
      .from("integrations")
      .update({ metadata: webhookMeta })
      .eq("id", row.id)
      .eq("store_id", input.state.storeId)
      .select()
      .single();
    if (!patched.error && patched.data) row = patched.data;
  }

  // Auto-install storefront UTM capture (ScriptTag → content_for_header). Soft-fail.
  try {
    const scriptTag = await registerShopifyAttributionScriptTag(shop, token.access_token);
    const scriptMeta = {
      ...asMetaRecord(row.metadata),
      mode: "live",
      shop_domain: shop,
      attribution_script_tag: {
        registered_at: new Date().toISOString(),
        ...scriptTag,
      },
    } as Json;
    const patched = await client
      .from("integrations")
      .update({ metadata: scriptMeta })
      .eq("id", row.id)
      .eq("store_id", input.state.storeId)
      .select()
      .single();
    throwQueryError(patched.error);
    if (patched.data) row = patched.data;
  } catch (err) {
    const scriptMeta = {
      ...asMetaRecord(row.metadata),
      mode: "live",
      shop_domain: shop,
      attribution_script_tag: {
        registered_at: new Date().toISOString(),
        ok: false,
        error: err instanceof Error ? err.message.slice(0, 300) : "script_tag_register_failed",
      },
    } as Json;
    const patched = await client
      .from("integrations")
      .update({ metadata: scriptMeta })
      .eq("id", row.id)
      .eq("store_id", input.state.storeId)
      .select()
      .single();
    if (!patched.error && patched.data) row = patched.data;
  }

  return row;
}

export async function testShopifyLiveConnection(
  client: DatabaseClient,
  agencyId: string,
  storeId: string,
): Promise<{ ok: boolean; shopName?: string; detail: string }> {
  const { data, error } = await client
    .from("integrations")
    .select("*")
    .eq("agency_id", agencyId)
    .eq("store_id", storeId)
    .eq("provider", "shopify")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  throwQueryError(error);

  if (!data?.secret_reference || !isEncryptedSecretRef(data.secret_reference)) {
    return { ok: false, detail: "No hay credencial Shopify cifrada. Conecta la tienda con OAuth." };
  }

  const settings = data.settings as { shop_domain?: string } | null;
  const meta = data.metadata as { shop_domain?: string } | null;
  const shop =
    settings?.shop_domain ||
    meta?.shop_domain ||
    data.external_account_name ||
    null;
  if (!shop) {
    return { ok: false, detail: "Falta el dominio de la tienda Shopify." };
  }

  try {
    const token = await ensureShopifyAccessToken(client, data, shop);
    const info = await fetchShopifyShopInfo(shop, token);
    const now = new Date().toISOString();
    await client
      .from("integrations")
      .update({
        status: "connected",
        last_success_at: now,
        last_error_at: null,
        last_error_message: null,
        external_account_name: info.myshopifyDomain,
        display_name: info.name,
      })
      .eq("id", data.id);

    await client.from("integration_health_checks").insert({
      agency_id: agencyId,
      store_id: storeId,
      integration_id: data.id,
      status: "healthy",
      latency_ms: null,
      safe_message: `Conectado a ${info.name}`,
      details: { shop: info.myshopifyDomain, name: info.name } as Json,
    });

    return { ok: true, shopName: info.name, detail: `Conectado a ${info.name}` };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error al consultar Shopify";
    const now = new Date().toISOString();
    await client
      .from("integrations")
      .update({
        status: "error",
        last_error_at: now,
        last_error_message: message.slice(0, 500),
      })
      .eq("id", data.id);
    return { ok: false, detail: message };
  }
}
