import type { IntegrationRow } from "@/types/database";
import { requireValue, throwQueryError, type DatabaseClient } from "./_shared";

/**
 * Returns integrations for the given agency, optionally filtered by store.
 * agency_id is required on all integrations; store_id is nullable (agency-wide integrations have no store).
 */
export async function listIntegrations(client: DatabaseClient, agencyId: string, storeId?: string | null): Promise<IntegrationRow[]> {
  let query = client.from("integrations").select().eq("agency_id", requireValue(agencyId, "Agencia inválida."));
  if (storeId) query = query.eq("store_id", storeId);
  const result = await query.order("created_at", { ascending: false });
  throwQueryError(result.error);
  return result.data ?? [];
}
