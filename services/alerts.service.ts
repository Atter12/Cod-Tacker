import type { AlertRow } from "@/types/database";
import { requireValue, throwQueryError, type DatabaseClient } from "./_shared";

/** Services receive the request-scoped typed client so RLS remains enforced and callers can test queries. */
export async function listAlerts(client: DatabaseClient, storeId: string, includeResolved = false): Promise<AlertRow[]> {
  let query = client.from("alerts").select().eq("store_id", requireValue(storeId, "Tienda inválida."));
  if (!includeResolved) query = query.is("resolved_at", null);
  const result = await query.order("created_at", { ascending: false });
  throwQueryError(result.error);
  return result.data ?? [];
}
