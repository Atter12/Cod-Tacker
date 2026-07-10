import type { DateRange } from "@/types/dashboard";
import type { AlertRow, IntegrationRow, OrderRow, ShipmentRow } from "@/types/database";
import { requireValue, throwQueryError, type DatabaseClient } from "./_shared";

export type DashboardSummary = {
  kpis: {
    ordersGenerated: number; ordersConfirmed: number; ordersDelivered: number; ordersReturned: number
    confirmationRate: number; deliveryRate: number; rto: number
    cashExpected: number; cashCollected: number; cashSettled: number
    roasCheckout: number; roasDelivered: number; roasCollected: number
  };
  recentOrders: OrderRow[];
  activeAlerts: AlertRow[];
  integrations: IntegrationRow[];
};

const sum = <T>(items: readonly T[], value: (item: T) => number): number => items.reduce((total, item) => total + value(item), 0);
const ratio = (numerator: number, denominator: number): number => denominator ? numerator / denominator : 0;

/** Executes independent store-scoped reads in parallel. RLS is enforced by the supplied request client. */
export async function getDashboardSummary(client: DatabaseClient, agencyId: string, storeId: string, dateRange: DateRange): Promise<DashboardSummary> {
  const aid = requireValue(agencyId, "Agencia inválida.");
  const id = requireValue(storeId, "Tienda inválida.");
  const from = requireValue(dateRange.from, "Fecha inicial inválida.");
  const to = requireValue(dateRange.to, "Fecha final inválida.");
  const [ordersResult, shipmentsResult, batchesResult, itemsResult, attributionsResult, spendResult, alertsResult, integrationsResult] = await Promise.all([
    client.from("orders").select().eq("store_id", id).gte("created_at_source", from).lte("created_at_source", to).order("created_at_source", { ascending: false }),
    client.from("shipments").select().eq("store_id", id).gte("created_at", from).lte("created_at", to),
    client.from("settlement_batches").select().eq("store_id", id).gte("created_at", from).lte("created_at", to),
    client.from("settlement_items").select("batch_id, settled_amount"),
    client.from("order_attributions").select("attributed_value").eq("store_id", id).gte("calculated_at", from).lte("calculated_at", to),
    client.from("ad_spend_daily").select("spend").eq("store_id", id).gte("metric_date", from).lte("metric_date", to),
    client.from("alerts").select().eq("agency_id", aid).eq("store_id", id).is("resolved_at", null).order("created_at", { ascending: false }),
    client.from("integrations").select().eq("agency_id", aid).eq("store_id", id).order("created_at", { ascending: false }),
  ]);
  for (const result of [ordersResult, shipmentsResult, batchesResult, itemsResult, attributionsResult, spendResult, alertsResult, integrationsResult]) throwQueryError(result.error);

  const orders = ordersResult.data ?? [];
  const shipments: ShipmentRow[] = shipmentsResult.data ?? [];
  const generated = orders.length;
  const confirmed = orders.filter((order) => order.order_status === "confirmed").length;
  const delivered = shipments.filter((shipment) => shipment.status === "delivered").length;
  const returned = shipments.filter((shipment) => shipment.status === "returned").length;
  const expected = sum(orders, (order) => order.expected_cod_amount ?? 0);
  const collected = sum(orders.filter((order) => order.payment_status === "cash_collected"), (order) => order.collected_cod_amount ?? 0);
  const batchIds = new Set((batchesResult.data ?? []).map((batch) => batch.id));
  const settledItems = (itemsResult.data ?? []).filter((item) => batchIds.has(item.batch_id));
  const settled = settledItems.length ? sum(settledItems, (item) => item.settled_amount) : sum(batchesResult.data ?? [], (batch) => batch.net_amount);
  const checkoutRevenue = sum(attributionsResult.data ?? [], (attribution) => attribution.attributed_value);
  const spend = sum(spendResult.data ?? [], (dailySpend) => dailySpend.spend);

  return {
    kpis: {
      ordersGenerated: generated, ordersConfirmed: confirmed, ordersDelivered: delivered, ordersReturned: returned,
      confirmationRate: ratio(confirmed, generated), deliveryRate: ratio(delivered, confirmed), rto: ratio(returned, delivered + returned),
      cashExpected: expected, cashCollected: collected, cashSettled: settled,
      roasCheckout: ratio(checkoutRevenue, spend), roasDelivered: ratio(expected * ratio(delivered, generated), spend), roasCollected: ratio(collected, spend),
    },
    recentOrders: orders.slice(0, 10),
    activeAlerts: alertsResult.data ?? [],
    integrations: integrationsResult.data ?? [],
  };
}
