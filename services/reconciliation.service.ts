import type { ReconciliationFilters } from "@/types/reconciliation";
import type { SettlementBatchRow, SettlementItemRow } from "@/types/database";
import { requireValue, throwQueryError, type DatabaseClient } from "./_shared";
import type { Enums } from "@/types/database.generated";
import { serializeCsv } from "@/lib/reconciliation/csv";
import { labelMatchMethod, labelMatchStatus } from "@/lib/reconciliation/labels";

export type ListSettlementBatchesOptions = ReconciliationFilters & {
  storeId: string;
  page?: number;
  pageSize?: number;
};

export type SettlementBatchListResult = {
  rows: SettlementBatchRow[];
  total: number;
  page: number;
  pageSize: number;
};

export type ListSettlementItemsOptions = {
  storeId: string;
  batchId?: string;
  matchStatuses?: Enums<"settlement_match_status">[];
  page?: number;
  pageSize?: number;
  discrepanciesOnly?: boolean;
};

export type SettlementItemsListResult = {
  rows: SettlementItemListRow[];
  total: number;
  page: number;
  pageSize: number;
};

/** Item row plus linked pedido fields (source of truth when matched). */
export type SettlementItemListRow = SettlementItemRow & {
  linked_order_number: string | null;
  linked_expected_cod_amount: number | null;
  linked_total_amount: number | null;
  linked_currency_code: string | null;
  linked_collected_cod_amount: number | null;
};

export type BatchItemCounts = Record<Enums<"settlement_match_status">, number>;

type LinkedOrderJoin = {
  order_number: string | null;
  expected_cod_amount: number | null;
  total_amount: number | null;
  currency_code: string | null;
  collected_cod_amount: number | null;
};

function linkedOrderFromJoin(
  orders: LinkedOrderJoin | LinkedOrderJoin[] | null | undefined,
): LinkedOrderJoin | null {
  if (!orders) return null;
  return Array.isArray(orders) ? (orders[0] ?? null) : orders;
}

/** Services receive the request-scoped typed client so RLS remains enforced. */
export async function listSettlementBatches(
  client: DatabaseClient,
  options: ListSettlementBatchesOptions,
): Promise<SettlementBatchRow[]> {
  let query = client
    .from("settlement_batches")
    .select()
    .eq("store_id", requireValue(options.storeId, "Tienda inválida."));
  if (options.statuses?.length) query = query.in("status", options.statuses);
  if (options.from) query = query.gte("created_at", options.from);
  if (options.to) query = query.lte("created_at", options.to);
  const result = await query.order("created_at", { ascending: false });
  throwQueryError(result.error);
  return result.data ?? [];
}

export async function listSettlementBatchesPaginated(
  client: DatabaseClient,
  options: ListSettlementBatchesOptions,
): Promise<SettlementBatchListResult> {
  const page = Math.max(1, options.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, options.pageSize ?? 25));
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let query = client
    .from("settlement_batches")
    .select("*", { count: "exact" })
    .eq("store_id", requireValue(options.storeId, "Tienda inválida."));
  if (options.statuses?.length) query = query.in("status", options.statuses);
  if (options.from) query = query.gte("created_at", options.from);
  if (options.to) query = query.lte("created_at", options.to);

  const result = await query.order("created_at", { ascending: false }).range(from, to);
  throwQueryError(result.error);
  return { rows: result.data ?? [], total: result.count ?? 0, page, pageSize };
}

export async function getSettlementBatchById(
  client: DatabaseClient,
  storeId: string,
  batchId: string,
): Promise<SettlementBatchRow | null> {
  const result = await client
    .from("settlement_batches")
    .select()
    .eq("store_id", requireValue(storeId, "Tienda inválida."))
    .eq("id", batchId)
    .maybeSingle();
  throwQueryError(result.error);
  return result.data;
}

export async function listSettlementItemsPaginated(
  client: DatabaseClient,
  options: ListSettlementItemsOptions,
): Promise<SettlementItemsListResult> {
  const page = Math.max(1, options.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, options.pageSize ?? 25));
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let query = client
    .from("settlement_items")
    .select(
      "*, orders!settlement_items_order_id_fkey ( order_number, expected_cod_amount, total_amount, currency_code, collected_cod_amount )",
      { count: "exact" },
    )
    .eq("store_id", requireValue(options.storeId, "Tienda inválida."));
  if (options.batchId) query = query.eq("batch_id", options.batchId);
  if (options.matchStatuses?.length) query = query.in("match_status", options.matchStatuses);
  if (options.discrepanciesOnly) {
    query = query.in("match_status", ["unmatched", "difference", "duplicate", "disputed"]);
  }

  const result = await query.order("source_row_number", { ascending: true }).range(from, to);
  throwQueryError(result.error);
  const rows: SettlementItemListRow[] = (result.data ?? []).map((row) => {
    const { orders, ...item } = row as SettlementItemRow & {
      orders?: LinkedOrderJoin | LinkedOrderJoin[] | null;
    };
    const linked = linkedOrderFromJoin(orders);
    return {
      ...item,
      linked_order_number: linked?.order_number?.trim() || null,
      linked_expected_cod_amount: linked?.expected_cod_amount ?? null,
      linked_total_amount: linked?.total_amount ?? null,
      linked_currency_code: linked?.currency_code ?? null,
      linked_collected_cod_amount: linked?.collected_cod_amount ?? null,
    };
  });
  return { rows, total: result.count ?? 0, page, pageSize };
}

export async function getSettlementItemById(
  client: DatabaseClient,
  storeId: string,
  itemId: string,
): Promise<SettlementItemRow | null> {
  const result = await client
    .from("settlement_items")
    .select()
    .eq("store_id", requireValue(storeId, "Tienda inválida."))
    .eq("id", itemId)
    .maybeSingle();
  throwQueryError(result.error);
  return result.data;
}

export async function countBatchMatchStatuses(
  client: DatabaseClient,
  storeId: string,
  batchId: string,
): Promise<BatchItemCounts> {
  const result = await client
    .from("settlement_items")
    .select("match_status")
    .eq("store_id", storeId)
    .eq("batch_id", batchId);
  throwQueryError(result.error);
  const counts: BatchItemCounts = {
    matched: 0,
    unmatched: 0,
    difference: 0,
    duplicate: 0,
    disputed: 0,
    resolved: 0,
  };
  for (const row of result.data ?? []) {
    const s = row.match_status as Enums<"settlement_match_status">;
    if (s in counts) counts[s] += 1;
  }
  return counts;
}

export function exportSettlementItemsCsv(items: SettlementItemRow[]): string {
  const headers = [
    "source_row",
    "tracking",
    "order_number",
    "match_status",
    "match_method",
    "expected",
    "settled",
    "fee",
    "difference",
    "discrepancy_reason",
    "order_id",
  ];
  const rows = items.map((item) => [
    item.source_row_number,
    item.tracking_number,
    item.order_number,
    labelMatchStatus(item.match_status),
    labelMatchMethod(item.match_method),
    item.expected_amount,
    item.settled_amount,
    item.fee_amount,
    item.difference_amount,
    item.discrepancy_reason,
    item.order_id,
  ]);
  return serializeCsv(headers, rows);
}
