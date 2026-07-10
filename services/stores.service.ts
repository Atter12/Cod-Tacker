import type { StoreRow } from "@/types/database";
import { requireValue, throwQueryError, type DatabaseClient } from "./_shared";

/** Services receive the request-scoped typed client so RLS remains enforced and callers can test queries. */
export async function listUserStores(client: DatabaseClient, userId: string): Promise<StoreRow[]> {
  requireValue(userId, "Usuario inválido.");
  const { data: memberships, error } = await client.from("store_members").select("store_id").eq("user_id", userId).eq("status", "active");
  throwQueryError(error);
  const storeIds = (memberships ?? []).map((membership) => membership.store_id);
  if (!storeIds.length) return [];
  const result = await client.from("stores").select().in("id", storeIds).order("name");
  throwQueryError(result.error);
  return result.data ?? [];
}

export async function getStoreBySlug(client: DatabaseClient, slug: string): Promise<StoreRow | null> {
  const result = await client.from("stores").select().eq("slug", requireValue(slug, "Tienda inválida.")).maybeSingle();
  throwQueryError(result.error);
  return result.data;
}

export async function listStoresForAgency(client: DatabaseClient, agencyId: string): Promise<StoreRow[]> {
  const result = await client.from("stores").select().eq("agency_id", requireValue(agencyId, "Agencia inválida.")).order("name");
  throwQueryError(result.error);
  return result.data ?? [];
}
