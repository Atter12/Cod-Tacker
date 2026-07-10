import type { ShipmentFilters } from "@/types/logistics";
import type { ShipmentRow } from "@/types/database";
import { requireValue, throwQueryError, type DatabaseClient } from "./_shared";

export type ListShipmentsOptions = ShipmentFilters & { storeId: string; limit?: number };

/** Services receive the request-scoped typed client so RLS remains enforced and callers can test queries. */
export async function listShipments(client: DatabaseClient, options: ListShipmentsOptions): Promise<ShipmentRow[]> {
  let query = client.from("shipments").select().eq("store_id", requireValue(options.storeId, "Tienda inválida."));
  if (options.statuses?.length) query = query.in("status", options.statuses);
  if (options.from) query = query.gte("created_at", options.from);
  if (options.to) query = query.lte("created_at", options.to);
  const result = await query.order("created_at", { ascending: false }).limit(Math.min(options.limit ?? 100, 100));
  throwQueryError(result.error);
  return result.data ?? [];
}
