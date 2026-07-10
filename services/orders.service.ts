import type { OrderFilters, PaginatedOrders } from "@/types/orders";
import { requireValue, throwQueryError, type DatabaseClient } from "./_shared";

export type ListOrdersOptions = OrderFilters & { storeId: string; page?: number; pageSize?: number };

/** Services receive the request-scoped typed client so RLS remains enforced and callers can test queries. */
export async function listOrders(client: DatabaseClient, options: ListOrdersOptions): Promise<PaginatedOrders> {
  const page = Math.max(options.page ?? 1, 1);
  const pageSize = Math.min(Math.max(options.pageSize ?? 25, 1), 100);
  let query = client.from("orders").select("*", { count: "exact" }).eq("store_id", requireValue(options.storeId, "Tienda inválida."));
  if (options.from) query = query.gte("created_at_source", options.from);
  if (options.to) query = query.lte("created_at_source", options.to);
  if (options.statuses?.length) query = query.in("order_status", options.statuses);
  if (options.paymentStatuses?.length) query = query.in("payment_status", options.paymentStatuses);
  if (options.search?.trim()) {
    const search = options.search.trim().replaceAll(",", " ");
    query = query.or(`order_number.ilike.%${search}%,external_order_id.ilike.%${search}%`);
  }
  const result = await query.order("created_at_source", { ascending: false }).range((page - 1) * pageSize, page * pageSize - 1);
  throwQueryError(result.error);
  return { data: result.data ?? [], total: result.count ?? 0, page, pageSize };
}
