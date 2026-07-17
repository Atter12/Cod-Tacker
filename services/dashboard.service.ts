import { dateRangeLabels, dateRangeToBounds, type DateRangePreset } from "@/lib/formatting/date-range";
import {
  dayKey,
  eachDayKey,
  emptySeriesPoint,
  isOrderConfirmed,
  previousPeriodBounds,
  ratio,
  toMetric,
} from "@/lib/dashboard/metrics";
import {
  computeDashboardRevenueTotals,
  isCashCollectedOrder,
  orderDeliveredValue,
  roasRatio,
} from "@/lib/dashboard/revenue";
import type {
  DashboardIntegrationHealth,
  DashboardRecentOrder,
  DashboardSummary,
  DashboardTimeSeriesPoint,
  DateRange,
} from "@/types/dashboard";
import type { IntegrationRow, OrderRow, ShipmentRow } from "@/types/database";
import { requireValue, throwQueryError, type DatabaseClient } from "./_shared";

type AttributionLite = { attributed_value: number; calculated_at: string };
type SpendLite = { spend: number; metric_date: string };
type CustomerLite = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
};

type PeriodTotals = {
  generated: number;
  confirmed: number;
  delivered: number;
  returned: number;
  cashCollected: number;
  cashExpected: number;
  checkoutRevenue: number;
  deliveredRevenue: number;
  spend: number;
  confirmationRate: number;
  deliveryRate: number;
  rto: number;
  roasCheckout: number | null;
  roasDelivered: number | null;
  roasCollected: number | null;
};

const sum = <T>(items: readonly T[], value: (item: T) => number): number =>
  items.reduce((total, item) => total + value(item), 0);

function computePeriodTotals(
  orders: OrderRow[],
  shipments: ShipmentRow[],
  attributions: AttributionLite[],
  spendRows: SpendLite[],
): PeriodTotals {
  const generated = orders.length;
  const confirmed = orders.filter(isOrderConfirmed).length;
  const delivered = shipments.filter((shipment) => shipment.status === "delivered").length;
  const returned = shipments.filter(
    (shipment) => shipment.status === "returned" || shipment.is_rto,
  ).length;
  const cashExpected = sum(orders, (order) => order.expected_cod_amount ?? 0);
  const checkoutRevenue = sum(attributions, (row) => row.attributed_value);
  const spend = sum(spendRows, (row) => row.spend);
  const confirmationRate = ratio(confirmed, generated);
  const deliveryRate = ratio(delivered, confirmed);
  const rto = ratio(returned, delivered + returned);

  const revenue = computeDashboardRevenueTotals({
    orders,
    shipments,
    checkoutRevenue,
    spend,
  });

  return {
    generated,
    confirmed,
    delivered,
    returned,
    cashCollected: revenue.collectedRevenue,
    cashExpected,
    checkoutRevenue: revenue.checkoutRevenue,
    deliveredRevenue: revenue.deliveredRevenue,
    spend,
    confirmationRate,
    deliveryRate,
    rto,
    roasCheckout: revenue.roasCheckout,
    roasDelivered: revenue.roasDelivered,
    roasCollected: revenue.roasCollected,
  };
}

function buildTimeSeries(
  from: string,
  to: string,
  orders: OrderRow[],
  shipments: ShipmentRow[],
  attributions: AttributionLite[],
  spendRows: SpendLite[],
  timeZone: string,
): DashboardTimeSeriesPoint[] {
  const map = new Map(eachDayKey(from, to, timeZone).map((date) => [date, emptySeriesPoint(date)]));
  const ordersById = new Map(orders.map((order) => [order.id, order]));
  /** Avoid double-counting COD value when an order has multiple delivered shipment rows. */
  const deliveredValueCounted = new Set<string>();

  const keyFor = (value: string) => {
    const trimmed = value.trim();
    // Ads spend metric_date is already a calendar day (YYYY-MM-DD).
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
    return dayKey(value, timeZone);
  };

  for (const order of orders) {
    const key = dayKey(order.created_at_source, timeZone);
    const point = map.get(key);
    if (!point) continue;
    point.ordersGenerated += 1;
    if (isOrderConfirmed(order)) point.ordersConfirmed += 1;
  }

  for (const order of orders) {
    if (!isCashCollectedOrder(order)) continue;
    const cashKey = dayKey(order.cash_collected_at ?? order.created_at_source, timeZone);
    const cashPoint = map.get(cashKey);
    if (cashPoint) cashPoint.cashCollected += order.collected_cod_amount ?? 0;
  }

  for (const shipment of shipments) {
    if (shipment.status === "delivered") {
      const key = dayKey(shipment.delivered_at ?? shipment.created_at, timeZone);
      const point = map.get(key);
      if (point) {
        point.ordersDelivered += 1;
        if (!shipment.is_rto && !deliveredValueCounted.has(shipment.order_id)) {
          deliveredValueCounted.add(shipment.order_id);
          const order = ordersById.get(shipment.order_id);
          if (order) point.deliveredRevenue += orderDeliveredValue(order);
        }
      }
    }
    if (shipment.status === "returned" || shipment.is_rto) {
      const key = dayKey(shipment.returned_at ?? shipment.created_at, timeZone);
      const point = map.get(key);
      if (point) point.ordersReturned += 1;
    }
  }

  for (const attribution of attributions) {
    const key = dayKey(attribution.calculated_at, timeZone);
    const point = map.get(key);
    if (point) point.checkoutRevenue += attribution.attributed_value;
  }

  for (const spend of spendRows) {
    const key = keyFor(spend.metric_date);
    const point = map.get(key);
    if (point) point.adSpend += spend.spend;
  }

  return [...map.values()].map((point) => {
    const terminal = point.ordersDelivered + point.ordersReturned;
    return {
      ...point,
      rto: ratio(point.ordersReturned, terminal),
      roasCheckout: roasRatio(point.checkoutRevenue, point.adSpend) ?? 0,
      roasDelivered: roasRatio(point.deliveredRevenue, point.adSpend) ?? 0,
      roasCollected: roasRatio(point.cashCollected, point.adSpend) ?? 0,
    };
  });
}

function integrationHealth(integrations: IntegrationRow[]): DashboardIntegrationHealth {
  const totalCount = integrations.length;
  if (totalCount === 0) {
    return { state: "empty", activeCount: 0, totalCount: 0, lastSyncAt: null, errorCount: 0 };
  }

  const activeCount = integrations.filter((row) => row.status === "connected").length;
  const errorCount = integrations.filter((row) => row.status === "error").length;
  const degradedCount = integrations.filter(
    (row) => row.status === "degraded" || row.status === "pending",
  ).length;
  const lastSyncAt =
    integrations
      .map((row) => row.last_success_at)
      .filter((value): value is string => Boolean(value))
      .sort()
      .at(-1) ?? null;

  if (errorCount > 0) {
    return { state: "error", activeCount, totalCount, lastSyncAt, errorCount };
  }
  if (degradedCount > 0 || activeCount < totalCount) {
    return { state: "warning", activeCount, totalCount, lastSyncAt, errorCount };
  }
  return { state: "healthy", activeCount, totalCount, lastSyncAt, errorCount };
}

function mapRecentOrders(
  orders: OrderRow[],
  shipments: ShipmentRow[],
  customers: CustomerLite[],
): DashboardRecentOrder[] {
  const customersById = new Map(customers.map((customer) => [customer.id, customer]));
  const shipmentByOrder = new Map<string, ShipmentRow>();
  for (const shipment of shipments) {
    const existing = shipmentByOrder.get(shipment.order_id);
    if (!existing || (shipment.delivered_at ?? shipment.created_at) > (existing.delivered_at ?? existing.created_at)) {
      shipmentByOrder.set(shipment.order_id, shipment);
    }
  }

  return orders.slice(0, 8).map((order) => {
    const customer = order.customer_id ? customersById.get(order.customer_id) : undefined;
    const shipment = shipmentByOrder.get(order.id);
    const name = [customer?.first_name, customer?.last_name].filter(Boolean).join(" ").trim() || null;
    return {
      id: order.id,
      orderNumber: order.order_number ?? order.external_order_id,
      createdAt: order.created_at_source,
      customerName: name,
      customerEmail: customer?.email ?? null,
      customerPhone: customer?.phone ?? null,
      status: order.order_status,
      deliveryStatus: shipment?.status ?? null,
      deliveredAt: order.delivered_at ?? shipment?.delivered_at ?? null,
      totalAmount: order.total_amount,
      currencyCode: order.currency_code,
      sourceName: order.source_name,
    };
  });
}

async function fetchPeriodDatasets(
  client: DatabaseClient,
  storeId: string,
  from: string,
  to: string,
  timeZone: string,
) {
  const spendFrom = dayKey(from, timeZone);
  const spendTo = dayKey(to, timeZone);
  const [ordersResult, shipmentsResult, attributionsResult, spendResult] = await Promise.all([
    client
      .from("orders")
      .select()
      .eq("store_id", storeId)
      .gte("created_at_source", from)
      .lte("created_at_source", to)
      .order("created_at_source", { ascending: false }),
    client
      .from("shipments")
      .select()
      .eq("store_id", storeId)
      .gte("created_at", from)
      .lte("created_at", to),
    client
      .from("order_attributions")
      .select("attributed_value, calculated_at")
      .eq("store_id", storeId)
      .gte("calculated_at", from)
      .lte("calculated_at", to),
    client
      .from("ad_spend_daily")
      .select("spend, metric_date")
      .eq("store_id", storeId)
      .gte("metric_date", spendFrom)
      .lte("metric_date", spendTo),
  ]);

  for (const result of [ordersResult, shipmentsResult, attributionsResult, spendResult]) {
    throwQueryError(result.error);
  }

  return {
    orders: (ordersResult.data ?? []) as OrderRow[],
    shipments: (shipmentsResult.data ?? []) as ShipmentRow[],
    attributions: (attributionsResult.data ?? []) as AttributionLite[],
    spendRows: (spendResult.data ?? []) as SpendLite[],
  };
}

/** Light shell meta for sidebar/topbar badges (unresolved alerts only). */
export async function getStoreActiveAlertCount(
  client: DatabaseClient,
  agencyId: string,
  storeId: string,
): Promise<number> {
  const result = await client
    .from("alerts")
    .select("id", { count: "exact", head: true })
    .eq("agency_id", requireValue(agencyId, "Agencia inválida."))
    .eq("store_id", requireValue(storeId, "Tienda inválida."))
    .is("resolved_at", null);
  throwQueryError(result.error);
  return result.count ?? 0;
}

/**
 * Store dashboard summary with current/previous period KPIs, daily series,
 * integration health and recent orders. RLS via request-scoped client.
 *
 * Formulas:
 * - confirmationRate = confirmed / generated
 * - deliveryRate = delivered / confirmed
 * - rto = returned / (delivered + returned)
 * - roasCheckout = attributed checkout revenue / ad spend
 * - roasDelivered = sum(expected COD of delivered orders) / ad spend
 * - roasCollected = sum(collected_cod_amount of cash-collected orders) / ad spend
 * - Confirmed includes confirmed_at, confirmation_status=confirmed, or post-confirmation order_status
 */
export async function getDashboardSummary(
  client: DatabaseClient,
  agencyId: string,
  storeId: string,
  dateRange: DateRange,
  options?: { rangePreset?: DateRangePreset },
): Promise<DashboardSummary> {
  const aid = requireValue(agencyId, "Agencia inválida.");
  const id = requireValue(storeId, "Tienda inválida.");

  const storeResult = await client
    .from("stores")
    .select("currency_code, timezone")
    .eq("id", id)
    .maybeSingle();
  throwQueryError(storeResult.error);

  const storeTimeZone =
    dateRange.timezone?.trim() || storeResult.data?.timezone?.trim() || "America/Lima";

  // Prefer preset bounds in store TZ so "Hoy" matches stores.timezone (not UTC host midnight).
  let from = requireValue(dateRange.from, "Fecha inicial inválida.");
  let to = requireValue(dateRange.to, "Fecha final inválida.");
  if (options?.rangePreset) {
    const bounds = dateRangeToBounds(options.rangePreset, new Date(), storeTimeZone);
    from = bounds.from.toISOString();
    to = bounds.to.toISOString();
  }
  const previous = previousPeriodBounds(from, to);

  const [current, previousData, alertsResult, integrationsResult] = await Promise.all([
    fetchPeriodDatasets(client, id, from, to, storeTimeZone),
    fetchPeriodDatasets(client, id, previous.from, previous.to, storeTimeZone),
    client
      .from("alerts")
      .select("id", { count: "exact", head: true })
      .eq("agency_id", aid)
      .eq("store_id", id)
      .is("resolved_at", null),
    client
      .from("integrations")
      .select()
      .eq("agency_id", aid)
      .eq("store_id", id)
      .order("created_at", { ascending: false }),
  ]);

  throwQueryError(alertsResult.error);
  throwQueryError(integrationsResult.error);

  const currentTotals = computePeriodTotals(
    current.orders,
    current.shipments,
    current.attributions,
    current.spendRows,
  );
  const previousTotals = computePeriodTotals(
    previousData.orders,
    previousData.shipments,
    previousData.attributions,
    previousData.spendRows,
  );

  const customerIds = [
    ...new Set(
      current.orders
        .slice(0, 8)
        .map((order) => order.customer_id)
        .filter((value): value is string => Boolean(value)),
    ),
  ];

  let customers: CustomerLite[] = [];
  if (customerIds.length) {
    const customersResult = await client
      .from("customers")
      .select("id, first_name, last_name, email, phone")
      .eq("store_id", id)
      .in("id", customerIds);
    throwQueryError(customersResult.error);
    customers = (customersResult.data ?? []) as CustomerLite[];
  }

  const currencyCode = storeResult.data?.currency_code ?? "PEN";
  const rangeLabel = options?.rangePreset
    ? dateRangeLabels[options.rangePreset]
    : "periodo anterior";

  return {
    currencyCode,
    rangeLabel,
    adSpend: currentTotals.spend,
    kpis: {
      ordersGenerated: toMetric(currentTotals.generated, previousTotals.generated),
      ordersConfirmed: toMetric(currentTotals.confirmed, previousTotals.confirmed),
      ordersDelivered: toMetric(currentTotals.delivered, previousTotals.delivered),
      ordersReturned: toMetric(currentTotals.returned, previousTotals.returned),
      cashCollected: toMetric(currentTotals.cashCollected, previousTotals.cashCollected),
      confirmationRate: toMetric(currentTotals.confirmationRate, previousTotals.confirmationRate),
      deliveryRate: toMetric(currentTotals.deliveryRate, previousTotals.deliveryRate),
      rto: toMetric(currentTotals.rto, previousTotals.rto),
      roasCheckout: toMetric(currentTotals.roasCheckout ?? 0, previousTotals.roasCheckout ?? 0),
      roasDelivered: toMetric(currentTotals.roasDelivered ?? 0, previousTotals.roasDelivered ?? 0),
      roasCollected: toMetric(currentTotals.roasCollected ?? 0, previousTotals.roasCollected ?? 0),
    },
    funnel: {
      generated: currentTotals.generated,
      confirmed: currentTotals.confirmed,
      delivered: currentTotals.delivered,
      returned: currentTotals.returned,
    },
    timeSeries: buildTimeSeries(
      from,
      to,
      current.orders,
      current.shipments,
      current.attributions,
      current.spendRows,
      storeTimeZone,
    ),
    integrationHealth: integrationHealth((integrationsResult.data ?? []) as IntegrationRow[]),
    recentOrders: mapRecentOrders(current.orders, current.shipments, customers),
    activeAlertCount: alertsResult.count ?? 0,
  };
}
