import type { CarrierConnectionRow, CarrierRow } from "@/types/database";
import { requireValue, throwQueryError, type DatabaseClient } from "./_shared";

/** Services receive the request-scoped typed client so RLS remains enforced and callers can test queries. */
export async function listCarriers(client: DatabaseClient): Promise<CarrierRow[]> {
  const result = await client.from("carriers").select().eq("is_active", true).order("name");
  throwQueryError(result.error);
  return result.data ?? [];
}

export async function listCarrierConnections(client: DatabaseClient, storeId: string): Promise<CarrierConnectionRow[]> {
  const result = await client.from("carrier_connections").select().eq("store_id", requireValue(storeId, "Tienda inválida.")).order("created_at", { ascending: false });
  throwQueryError(result.error);
  return result.data ?? [];
}
