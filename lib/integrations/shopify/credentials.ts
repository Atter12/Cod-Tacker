import "server-only";

import { decryptSecret, encryptSecret, isEncryptedSecretRef } from "@/lib/crypto/secret-box";
import { getShopifyEnv } from "@/lib/integrations/shopify/env";
import type { DatabaseClient } from "@/services/_shared";
import type { IntegrationRow } from "@/types/database";
import type { Json } from "@/types/database.generated";

export type ShopifyStoredCredentials = {
  /** Always present. */
  access_token: string;
  /** True when acquired with expiring=1. */
  expiring?: boolean;
  refresh_token?: string | null;
  /** ISO timestamp when access_token expires. */
  access_token_expires_at?: string | null;
  /** ISO timestamp when refresh_token expires. */
  refresh_token_expires_at?: string | null;
};

const REFRESH_SKEW_MS = 60_000;

export function packShopifyCredentials(creds: ShopifyStoredCredentials): string {
  return encryptSecret(JSON.stringify(creds));
}

/** Supports legacy plaintext access_token blobs and new JSON credential packs. */
export function unpackShopifyCredentials(secretReference: string): ShopifyStoredCredentials {
  const raw = decryptSecret(secretReference);
  try {
    const parsed = JSON.parse(raw) as Partial<ShopifyStoredCredentials>;
    if (parsed && typeof parsed.access_token === "string" && parsed.access_token.length > 0) {
      return {
        access_token: parsed.access_token,
        expiring: Boolean(parsed.expiring ?? parsed.refresh_token),
        refresh_token: typeof parsed.refresh_token === "string" ? parsed.refresh_token : null,
        access_token_expires_at:
          typeof parsed.access_token_expires_at === "string" ? parsed.access_token_expires_at : null,
        refresh_token_expires_at:
          typeof parsed.refresh_token_expires_at === "string"
            ? parsed.refresh_token_expires_at
            : null,
      };
    }
  } catch {
    /* legacy single-token blob */
  }
  return { access_token: raw, expiring: false };
}

function expiresSoon(iso: string | null | undefined): boolean {
  if (!iso) return false;
  const at = Date.parse(iso);
  if (!Number.isFinite(at)) return false;
  return at <= Date.now() + REFRESH_SKEW_MS;
}

export async function refreshShopifyOfflineToken(input: {
  shop: string;
  refreshToken: string;
}): Promise<ShopifyStoredCredentials> {
  const env = getShopifyEnv();
  const res = await fetch(`https://${input.shop}/admin/oauth/access_token`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({
      client_id: env.clientId,
      client_secret: env.clientSecret,
      grant_type: "refresh_token",
      refresh_token: input.refreshToken,
    }),
    cache: "no-store",
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Shopify token refresh failed (${res.status}): ${text.slice(0, 200)}`);
  }
  const data = (await res.json()) as {
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
    refresh_token_expires_in?: number;
  };
  if (!data.access_token || !data.refresh_token) {
    throw new Error("Shopify refresh no devolvió access_token/refresh_token.");
  }
  const now = Date.now();
  return {
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    expiring: true,
    access_token_expires_at: new Date(now + (data.expires_in ?? 3600) * 1000).toISOString(),
    refresh_token_expires_at: new Date(
      now + (data.refresh_token_expires_in ?? 7776000) * 1000,
    ).toISOString(),
  };
}

/**
 * Return a usable Admin API access token, refreshing expiring offline tokens when needed.
 * Persists rotated credentials back onto the integration row.
 */
export async function ensureShopifyAccessToken(
  client: DatabaseClient,
  integration: Pick<
    IntegrationRow,
    "id" | "agency_id" | "store_id" | "secret_reference" | "settings" | "metadata"
  >,
  shop: string,
): Promise<string> {
  if (!isEncryptedSecretRef(integration.secret_reference)) {
    throw new Error("Falta credencial Shopify cifrada.");
  }

  let creds = unpackShopifyCredentials(integration.secret_reference);
  const needsRefresh =
    Boolean(creds.expiring && creds.refresh_token) &&
    (!creds.access_token_expires_at || expiresSoon(creds.access_token_expires_at));

  if (needsRefresh && creds.refresh_token) {
    if (creds.refresh_token_expires_at && expiresSoon(creds.refresh_token_expires_at)) {
      throw new Error(
        "El refresh token de Shopify expiró. Reautoriza la tienda (Conectar Shopify).",
      );
    }
    creds = await refreshShopifyOfflineToken({ shop, refreshToken: creds.refresh_token });
    const packed = packShopifyCredentials(creds);
    const settings =
      integration.settings && typeof integration.settings === "object" && !Array.isArray(integration.settings)
        ? { ...(integration.settings as Record<string, unknown>) }
        : {};
    settings.shopify_token_expiring = true;
    settings.shopify_access_token_expires_at = creds.access_token_expires_at ?? null;
    let update = client
      .from("integrations")
      .update({
        secret_reference: packed,
        settings: settings as Json,
        last_success_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", integration.id)
      .eq("agency_id", integration.agency_id);
    if (integration.store_id) {
      update = update.eq("store_id", integration.store_id);
    }
    await update;
  }

  return creds.access_token;
}
