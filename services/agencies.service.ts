import type { AgencyRow } from "@/types/database";
import { requireValue, throwQueryError, type DatabaseClient } from "./_shared";

/** Services receive the request-scoped typed client so RLS remains enforced and callers can test queries. */
export async function listUserAgencies(client: DatabaseClient, userId: string): Promise<AgencyRow[]> {
  requireValue(userId, "Usuario inválido.");
  const { data: memberships, error } = await client.from("agency_members").select("agency_id").eq("user_id", userId).eq("status", "active");
  throwQueryError(error);
  const agencyIds = (memberships ?? []).map((membership) => membership.agency_id);
  if (!agencyIds.length) return [];
  const result = await client.from("agencies").select().in("id", agencyIds).order("name");
  throwQueryError(result.error);
  return result.data ?? [];
}

export async function getAgencyBySlug(client: DatabaseClient, slug: string): Promise<AgencyRow | null> {
  const result = await client.from("agencies").select().eq("slug", requireValue(slug, "Agencia inválida.")).maybeSingle();
  throwQueryError(result.error);
  return result.data;
}
