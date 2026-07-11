import { normalizePagination, toPaginatedResult, type PaginatedResult } from "@/lib/http/pagination";
import type { ShipmentFilters } from "@/types/logistics";
import type {
  BackgroundJobRow,
  CustomerRow,
  OrderRow,
  RawEventRow,
  ShipmentEventRow,
  ShipmentRow,
} from "@/types/database";
import type { Enums } from "@/types/database.generated";
import { requireValue, throwQueryError, type DatabaseClient } from "./_shared";

export type ListShipmentsOptions = ShipmentFilters & {
  storeId: string;
  carrierId?: string;
  isRto?: boolean;
  isTerminal?: boolean;
  search?: string;
  page?: number;
  pageSize?: number;
  limit?: number;
};

/** Services receive the request-scoped typed client so RLS remains enforced and callers can test queries. */
export async function listShipments(
  client: DatabaseClient,
  options: ListShipmentsOptions,
): Promise<ShipmentRow[]> {
  const result = await listShipmentsPaginated(client, {
    ...options,
    page: 1,
    pageSize: Math.min(options.limit ?? 100, 100),
  });
  return result.data;
}

export async function listShipmentsPaginated(
  client: DatabaseClient,
  options: ListShipmentsOptions,
): Promise<PaginatedResult<ShipmentRow>> {
  const { page, pageSize, offset, limit } = normalizePagination(options.page, options.pageSize, {
    pageSize: options.limit ? Math.min(options.limit, 100) : 25,
  });

  let query = client
    .from("shipments")
    .select("*", { count: "exact" })
    .eq("store_id", requireValue(options.storeId, "Tienda inválida."));

  if (options.statuses?.length) query = query.in("status", options.statuses);
  if (options.carrierIds?.length) query = query.in("carrier_id", options.carrierIds);
  if (options.carrierId) query = query.eq("carrier_id", options.carrierId);
  if (options.isRto != null) query = query.eq("is_rto", options.isRto);
  if (options.isTerminal != null) query = query.eq("is_terminal", options.isTerminal);
  if (options.from) query = query.gte("created_at", options.from);
  if (options.to) query = query.lte("created_at", options.to);

  const search = options.search?.trim();
  if (search) {
    const escaped = search.replace(/[%_,]/g, "").slice(0, 100);
    if (escaped) {
      query = query.or(`tracking_number.ilike.%${escaped}%,external_shipment_id.ilike.%${escaped}%`);
    }
  }

  const result = await query
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);
  throwQueryError(result.error);
  return toPaginatedResult(result.data ?? [], result.count ?? 0, page, pageSize);
}

export type ShipmentDetail = {
  shipment: ShipmentRow;
  events: ShipmentEventRow[];
  order: OrderRow | null;
  customer: CustomerRow | null;
  rawEvents: RawEventRow[];
  jobs: BackgroundJobRow[];
};

export async function getShipmentDetail(
  client: DatabaseClient,
  storeId: string,
  shipmentId: string,
): Promise<ShipmentDetail | null> {
  const shipmentResult = await client
    .from("shipments")
    .select()
    .eq("store_id", requireValue(storeId, "Tienda inválida."))
    .eq("id", requireValue(shipmentId, "Envío inválido."))
    .maybeSingle();
  throwQueryError(shipmentResult.error);
  if (!shipmentResult.data) return null;

  const shipment = shipmentResult.data;
  const [eventsResult, orderResult] = await Promise.all([
    client
      .from("shipment_events")
      .select()
      .eq("shipment_id", shipment.id)
      .order("occurred_at", { ascending: false })
      .limit(100),
    client.from("orders").select().eq("id", shipment.order_id).eq("store_id", storeId).maybeSingle(),
  ]);
  throwQueryError(eventsResult.error);
  throwQueryError(orderResult.error);

  const events = eventsResult.data ?? [];
  const order = orderResult.data;

  let customer: CustomerRow | null = null;
  if (order?.customer_id) {
    const customerResult = await client
      .from("customers")
      .select()
      .eq("id", order.customer_id)
      .maybeSingle();
    throwQueryError(customerResult.error);
    customer = customerResult.data;
  }

  const rawEventIds = [
    ...new Set(events.map((e) => e.raw_event_id).filter((id): id is string => Boolean(id))),
  ];

  let rawEvents: RawEventRow[] = [];
  let jobs: BackgroundJobRow[] = [];
  if (rawEventIds.length) {
    const [rawResult, jobsResult] = await Promise.all([
      client.from("raw_events").select().in("id", rawEventIds).limit(50),
      client.from("background_jobs").select().in("raw_event_id", rawEventIds).limit(50),
    ]);
    throwQueryError(rawResult.error);
    throwQueryError(jobsResult.error);
    rawEvents = rawResult.data ?? [];
    jobs = jobsResult.data ?? [];
  }

  // Also correlate by tracking in job payloads is expensive; tracking_number search on jobs skipped.
  return { shipment, events, order, customer, rawEvents, jobs };
}

export async function getShipmentById(
  client: DatabaseClient,
  storeId: string,
  shipmentId: string,
): Promise<ShipmentRow | null> {
  const result = await client
    .from("shipments")
    .select()
    .eq("store_id", requireValue(storeId, "Tienda inválida."))
    .eq("id", requireValue(shipmentId, "Envío inválido."))
    .maybeSingle();
  throwQueryError(result.error);
  return result.data;
}

export type { Enums };
