import { normalizePagination } from "@/lib/http/pagination";
import { buildOrderTimeline } from "@/lib/orders/timeline";
import type {
  Order,
  OrderDetailBundle,
  OrderFilters,
  OrderListRow,
  OrderNote,
  OrderSortField,
  PaginatedOrders,
} from "@/types/orders";
import { requireValue, throwQueryError, type DatabaseClient } from "./_shared";

export type ListOrdersOptions = OrderFilters & { storeId: string; page?: number; pageSize?: number };

const SORTABLE: Record<OrderSortField, OrderSortField> = {
  created_at_source: "created_at_source",
  total_amount: "total_amount",
  order_status: "order_status",
};

function escapeIlike(value: string): string {
  return value.replaceAll("%", "\\%").replaceAll("_", "\\_").replaceAll(",", " ");
}

/** Services receive the request-scoped typed client so RLS remains enforced. */
export async function listOrders(client: DatabaseClient, options: ListOrdersOptions): Promise<PaginatedOrders> {
  const storeId = requireValue(options.storeId, "Tienda inválida.");
  const { page, pageSize } = normalizePagination(options.page, options.pageSize);
  const sortBy = options.sortBy && SORTABLE[options.sortBy] ? options.sortBy : "created_at_source";
  const ascending = options.sortDir === "asc";

  let query = client.from("orders").select("*", { count: "exact" }).eq("store_id", storeId);

  if (options.from) query = query.gte("created_at_source", options.from);
  if (options.to) query = query.lte("created_at_source", options.to);
  if (options.statuses?.length) query = query.in("order_status", options.statuses);
  if (options.paymentStatuses?.length) query = query.in("payment_status", options.paymentStatuses);
  if (options.confirmationStatuses?.length) {
    query = query.in("confirmation_status", options.confirmationStatuses);
  }
  if (options.city?.trim()) query = query.ilike("shipping_city", `%${escapeIlike(options.city.trim())}%`);
  if (options.district?.trim()) {
    query = query.ilike("shipping_district", `%${escapeIlike(options.district.trim())}%`);
  }
  if (typeof options.minAmount === "number" && Number.isFinite(options.minAmount)) {
    query = query.gte("total_amount", options.minAmount);
  }
  if (typeof options.maxAmount === "number" && Number.isFinite(options.maxAmount)) {
    query = query.lte("total_amount", options.maxAmount);
  }

  if (options.search?.trim()) {
    const search = escapeIlike(options.search.trim());
    const { data: customerMatches } = await client
      .from("customers")
      .select("id")
      .eq("store_id", storeId)
      .or(
        `first_name.ilike.%${search}%,last_name.ilike.%${search}%,email.ilike.%${search}%,phone.ilike.%${search}%`,
      )
      .limit(50);
    const customerIds = (customerMatches ?? []).map((row) => row.id);
    const orParts = [
      `order_number.ilike.%${search}%`,
      `external_order_id.ilike.%${search}%`,
      `source_name.ilike.%${search}%`,
      ...(customerIds.length ? [`customer_id.in.(${customerIds.join(",")})`] : []),
    ];
    query = query.or(orParts.join(","));
  }

  const result = await query
    .order(sortBy, { ascending })
    .range((page - 1) * pageSize, page * pageSize - 1);
  throwQueryError(result.error);
  return { data: (result.data ?? []) as Order[], total: result.count ?? 0, page, pageSize };
}

/** Attaches customer display fields for list/table rendering. */
export async function enrichOrdersWithCustomers(
  client: DatabaseClient,
  storeId: string,
  orders: Order[],
): Promise<OrderListRow[]> {
  const customerIds = [
    ...new Set(orders.map((order) => order.customer_id).filter((id): id is string => Boolean(id))),
  ];
  if (!customerIds.length) {
    return orders.map((order) => ({
      ...order,
      customerName: null,
      customerEmail: null,
      customerPhone: null,
    }));
  }

  const customersResult = await client
    .from("customers")
    .select("id, first_name, last_name, email, phone")
    .eq("store_id", requireValue(storeId, "Tienda inválida."))
    .in("id", customerIds);
  throwQueryError(customersResult.error);

  const byId = new Map(
    (customersResult.data ?? []).map((customer) => [
      customer.id,
      {
        name: [customer.first_name, customer.last_name].filter(Boolean).join(" ").trim() || null,
        email: customer.email,
        phone: customer.phone,
      },
    ]),
  );

  return orders.map((order) => {
    const customer = order.customer_id ? byId.get(order.customer_id) : undefined;
    return {
      ...order,
      customerName: customer?.name ?? null,
      customerEmail: customer?.email ?? null,
      customerPhone: customer?.phone ?? null,
    };
  });
}

/**
 * Loads a single order for the store (IDOR-safe: always filters by store_id).
 */
export async function getOrderById(
  client: DatabaseClient,
  storeId: string,
  orderId: string,
): Promise<Order | null> {
  const { data, error } = await client
    .from("orders")
    .select("*")
    .eq("store_id", requireValue(storeId, "Tienda inválida."))
    .eq("id", requireValue(orderId, "Pedido inválido."))
    .maybeSingle();
  throwQueryError(error);
  return data;
}

export async function getOrderDetail(
  client: DatabaseClient,
  storeId: string,
  orderId: string,
): Promise<OrderDetailBundle | null> {
  const order = await getOrderById(client, storeId, orderId);
  if (!order) return null;

  const [
    itemsRes,
    customerRes,
    historyRes,
    attributionsRes,
    shipmentsRes,
    notesRes,
    alertsRes,
    conversionsRes,
    settlementItemsRes,
    whatsappConvRes,
    auditRes,
  ] = await Promise.all([
    client.from("order_items").select("*").eq("order_id", order.id).eq("store_id", storeId),
    order.customer_id
      ? client.from("customers").select("*").eq("id", order.customer_id).eq("store_id", storeId).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    client
      .from("order_status_history")
      .select("*")
      .eq("order_id", order.id)
      .eq("store_id", storeId)
      .order("occurred_at", { ascending: false }),
    client
      .from("order_attributions")
      .select("*")
      .eq("order_id", order.id)
      .eq("store_id", storeId)
      .order("calculated_at", { ascending: false }),
    client.from("shipments").select("*").eq("order_id", order.id).eq("store_id", storeId),
    client
      .from("order_notes")
      .select("*")
      .eq("order_id", order.id)
      .eq("store_id", storeId)
      .order("created_at", { ascending: false }),
    client.from("alerts").select("*").eq("order_id", order.id).eq("store_id", storeId),
    client.from("conversion_events").select("*").eq("order_id", order.id).eq("store_id", storeId),
    client.from("settlement_items").select("*").eq("order_id", order.id).eq("store_id", storeId),
    client.from("whatsapp_conversations").select("*").eq("order_id", order.id).eq("store_id", storeId),
    client
      .from("audit_logs")
      .select("*")
      .eq("entity_type", "order")
      .eq("entity_id", order.id)
      .eq("store_id", storeId)
      .order("created_at", { ascending: false })
      .limit(50),
  ]);

  for (const res of [
    itemsRes,
    historyRes,
    attributionsRes,
    shipmentsRes,
    notesRes,
    alertsRes,
    conversionsRes,
    settlementItemsRes,
    whatsappConvRes,
    auditRes,
  ]) {
    throwQueryError(res.error);
  }
  throwQueryError(customerRes.error);

  const shipments = shipmentsRes.data ?? [];
  const shipmentIds = shipments.map((row) => row.id);
  const shipmentEventsRes = shipmentIds.length
    ? await client
        .from("shipment_events")
        .select("*")
        .in("shipment_id", shipmentIds)
        .eq("store_id", storeId)
        .order("occurred_at", { ascending: false })
    : { data: [], error: null };
  throwQueryError(shipmentEventsRes.error);

  const conversations = whatsappConvRes.data ?? [];
  const conversationIds = conversations.map((row) => row.id);
  const messagesRes = conversationIds.length
    ? await client
        .from("whatsapp_messages")
        .select("*")
        .in("conversation_id", conversationIds)
        .eq("store_id", storeId)
        .order("created_at", { ascending: false })
        .limit(100)
    : { data: [], error: null };
  throwQueryError(messagesRes.error);

  const batchIds = [...new Set((settlementItemsRes.data ?? []).map((row) => row.batch_id).filter(Boolean))];
  const batchesRes = batchIds.length
    ? await client.from("settlement_batches").select("*").in("id", batchIds).eq("store_id", storeId)
    : { data: [], error: null };
  throwQueryError(batchesRes.error);

  // Correlated raw_events: by store + time window around order (no order_id FK)
  const windowStart = new Date(new Date(order.created_at_source).getTime() - 1000 * 60 * 60 * 24).toISOString();
  const windowEnd = new Date(new Date(order.created_at_source).getTime() + 1000 * 60 * 60 * 24 * 14).toISOString();
  const rawRes = await client
    .from("raw_events")
    .select("*")
    .eq("store_id", storeId)
    .gte("received_at", windowStart)
    .lte("received_at", windowEnd)
    .order("received_at", { ascending: false })
    .limit(20);
  throwQueryError(rawRes.error);

  const bundle: Omit<OrderDetailBundle, "timeline"> = {
    order,
    items: itemsRes.data ?? [],
    customer: customerRes.data ?? null,
    statusHistory: historyRes.data ?? [],
    attributions: attributionsRes.data ?? [],
    shipments,
    shipmentEvents: shipmentEventsRes.data ?? [],
    whatsappConversations: conversations,
    whatsappMessages: messagesRes.data ?? [],
    settlementItems: settlementItemsRes.data ?? [],
    settlementBatches: batchesRes.data ?? [],
    conversionEvents: conversionsRes.data ?? [],
    rawEvents: rawRes.data ?? [],
    auditLogs: auditRes.data ?? [],
    notes: (notesRes.data ?? []) as OrderNote[],
    alerts: alertsRes.data ?? [],
  };

  return { ...bundle, timeline: buildOrderTimeline(bundle) };
}
