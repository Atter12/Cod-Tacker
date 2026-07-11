import { throwQueryError, type DatabaseClient } from "./_shared";
import { sanitizeApiKeyRow } from "@/lib/api-keys/crypto";

/** Public-safe API key row — never includes key_hash. */
export type ApiKeyListItem = {
  id: string;
  name: string;
  key_prefix: string;
  scopes: string[];
  status: string;
  last_used_at: string | null;
  expires_at: string | null;
  revoked_at: string | null;
  created_at: string;
  store_id: string | null;
};

export async function listApiKeys(
  client: DatabaseClient,
  agencyId: string,
): Promise<ApiKeyListItem[]> {
  const { data, error } = await client
    .from("api_keys")
    .select("id, name, key_prefix, scopes, status, last_used_at, expires_at, revoked_at, created_at, store_id, key_hash")
    .eq("agency_id", agencyId)
    .order("created_at", { ascending: false });
  throwQueryError(error);
  return (data ?? []).map((row) => {
    const safe = sanitizeApiKeyRow(row);
    return {
      id: safe.id,
      name: safe.name,
      key_prefix: safe.key_prefix,
      scopes: safe.scopes,
      status: safe.status,
      last_used_at: safe.last_used_at,
      expires_at: safe.expires_at,
      revoked_at: safe.revoked_at,
      created_at: safe.created_at,
      store_id: safe.store_id,
    };
  });
}
