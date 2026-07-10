import type { ReconciliationFilters } from "@/types/reconciliation";
import type { SettlementBatchRow } from "@/types/database";
import { requireValue, throwQueryError, type DatabaseClient } from "./_shared";

export type ListSettlementBatchesOptions = ReconciliationFilters & { storeId: string };

/** Services receive the request-scoped typed client so RLS remains enforced and callers can test queries. */
export async function listSettlementBatches(client: DatabaseClient, options: ListSettlementBatchesOptions): Promise<SettlementBatchRow[]> {
  let query = client.from("settlement_batches").select().eq("store_id", requireValue(options.storeId, "Tienda inválida."));
  if (options.statuses?.length) query = query.in("status", options.statuses);
  if (options.from) query = query.gte("created_at", options.from);
  if (options.to) query = query.lte("created_at", options.to);
  const result = await query.order("created_at", { ascending: false });
  throwQueryError(result.error);
  return result.data ?? [];
}
