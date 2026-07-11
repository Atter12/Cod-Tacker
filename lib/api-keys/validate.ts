import "server-only";

import type { DatabaseClient } from "@/services/_shared";
import { hashApiKey, verifyApiKey, type ApiKeyScope } from "@/lib/api-keys/crypto";

export const DEFAULT_API_KEY_RATE_LIMIT = 60;
export const DEFAULT_API_KEY_WINDOW_SECONDS = 60;

export type ValidatedApiKey = {
  id: string;
  agencyId: string;
  storeId: string | null;
  scopes: string[];
  name: string;
};

export type ApiKeyAuthResult =
  | { ok: true; key: ValidatedApiKey }
  | { ok: false; status: 401 | 403 | 429; error: string };

/**
 * Internal helper: validate API key from Authorization Bearer / X-Api-Key.
 * Never returns key_hash. Updates last_used_at and enforces basic rate limit
 * via `api_key_rate_limits` (service-role recommended for write path).
 *
 * Rate limiting is persistent (per minute window). Documented defaults:
 * DEFAULT_API_KEY_RATE_LIMIT requests / DEFAULT_API_KEY_WINDOW_SECONDS seconds.
 */
export async function validateApiKeyRequest(
  client: DatabaseClient,
  opts: {
    rawKey: string | null | undefined;
    requiredScopes?: readonly ApiKeyScope[];
    rateLimit?: number;
    windowSeconds?: number;
  },
): Promise<ApiKeyAuthResult> {
  const raw = opts.rawKey?.trim();
  if (!raw || !raw.startsWith("ctk_")) {
    return { ok: false, status: 401, error: "API key inválida o ausente." };
  }

  const keyHash = hashApiKey(raw);
  const { data: row, error } = await client
    .from("api_keys")
    .select("id, agency_id, store_id, scopes, name, status, expires_at, key_hash")
    .eq("key_hash", keyHash)
    .maybeSingle();

  if (error || !row) {
    return { ok: false, status: 401, error: "API key inválida o ausente." };
  }

  // Defense in depth — verify even though we looked up by hash.
  if (!verifyApiKey(raw, row.key_hash)) {
    return { ok: false, status: 401, error: "API key inválida o ausente." };
  }

  if (row.status !== "active") {
    return { ok: false, status: 403, error: "API key revocada o inactiva." };
  }
  if (row.expires_at && new Date(row.expires_at).getTime() < Date.now()) {
    return { ok: false, status: 403, error: "API key expirada." };
  }

  const required = opts.requiredScopes ?? [];
  for (const scope of required) {
    if (!row.scopes.includes(scope)) {
      return { ok: false, status: 403, error: "La API key no tiene el alcance requerido." };
    }
  }

  const limit = opts.rateLimit ?? DEFAULT_API_KEY_RATE_LIMIT;
  const windowSeconds = opts.windowSeconds ?? DEFAULT_API_KEY_WINDOW_SECONDS;
  const windowStart = new Date();
  windowStart.setSeconds(0, 0);
  if (windowSeconds >= 60) {
    // align to minute boundary already set
  } else {
    const ms = windowSeconds * 1000;
    windowStart.setTime(Math.floor(Date.now() / ms) * ms);
  }

  const { data: existing } = await client
    .from("api_key_rate_limits")
    .select("id, request_count")
    .eq("api_key_id", row.id)
    .eq("window_start", windowStart.toISOString())
    .maybeSingle();

  if (existing && existing.request_count >= limit) {
    return { ok: false, status: 429, error: "Límite de solicitudes de API excedido. Intenta más tarde." };
  }

  if (existing) {
    await client
      .from("api_key_rate_limits")
      .update({
        request_count: existing.request_count + 1,
        updated_at: new Date().toISOString(),
      })
      .eq("id", existing.id);
  } else {
    await client.from("api_key_rate_limits").insert({
      api_key_id: row.id,
      agency_id: row.agency_id,
      window_start: windowStart.toISOString(),
      window_seconds: windowSeconds,
      request_count: 1,
    });
  }

  await client
    .from("api_keys")
    .update({ last_used_at: new Date().toISOString() })
    .eq("id", row.id);

  return {
    ok: true,
    key: {
      id: row.id,
      agencyId: row.agency_id,
      storeId: row.store_id,
      scopes: row.scopes,
      name: row.name,
    },
  };
}
