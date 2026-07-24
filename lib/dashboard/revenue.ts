import { ratio } from "@/lib/dashboard/metrics";

/** Minimal order shape for dashboard revenue / ROAS. */
export type DashboardRevenueOrder = {
  id: string;
  expected_cod_amount: number | null;
  collected_cod_amount: number | null;
  settled_cod_amount: number | null;
  total_amount: number;
  payment_status: string;
  cash_collected_at: string | null;
  settled_at: string | null;
};

/** Minimal shipment shape for delivered value. */
export type DashboardRevenueShipment = {
  order_id: string;
  status: string;
  is_rto: boolean;
};

export type DashboardRevenueTotals = {
  checkoutRevenue: number;
  /** Expected COD (or total) for orders with a delivered shipment — not a delivery-rate proxy. */
  deliveredRevenue: number;
  /**
   * Provisional door cash (`cash_collected` / collected_cod_amount).
   * May include assumed collection on delivered — not the product ROAS truth.
   */
  collectedRevenue: number;
  /**
   * Reconciled cash after Conciliación approve (CSV / Ecart Pay).
   * Primary denominator for CODTracked ROAS effectiveness.
   */
  settledRevenue: number;
  spend: number;
  /** null when spend <= 0 (no fake 0.00 ROAS). */
  roasCheckout: number | null;
  roasDelivered: number | null;
  roasCollected: number | null;
  roasSettled: number | null;
};

/** Revenue ÷ spend; null when there is no ad spend (same rule as attribution KPIs). */
export function roasRatio(numerator: number, spend: number): number | null {
  if (!Number.isFinite(numerator) || !Number.isFinite(spend) || spend <= 0) return null;
  return numerator / spend;
}

export function isCashCollectedOrder(order: {
  payment_status: string;
  cash_collected_at: string | null;
}): boolean {
  return (
    order.payment_status === "cash_collected" ||
    order.payment_status === "partially_collected" ||
    order.payment_status === "settlement_pending" ||
    order.payment_status === "settled" ||
    Boolean(order.cash_collected_at)
  );
}

export function isSettledOrder(order: {
  payment_status: string;
  settled_at: string | null;
  settled_cod_amount: number | null;
}): boolean {
  if (order.payment_status === "settled") return true;
  if (order.settled_at) return true;
  return order.settled_cod_amount != null && order.settled_cod_amount > 0;
}

/** COD expected at door; falls back to order total when expected COD is unset. */
export function orderDeliveredValue(order: {
  expected_cod_amount: number | null;
  total_amount: number;
}): number {
  const expected = order.expected_cod_amount;
  if (expected != null && Number.isFinite(expected)) return expected;
  return order.total_amount ?? 0;
}

/**
 * Legacy (pre-S13) proxy — do not use in product metrics.
 * Inflates/deflates revenue by delivered/generated order counts.
 */
export function legacyDeliveredRevenueProxy(input: {
  cashExpected: number;
  deliveredCount: number;
  generatedCount: number;
}): number {
  return input.cashExpected * ratio(input.deliveredCount, input.generatedCount);
}

/**
 * Honest revenue layers for dashboard ROAS:
 * - checkout: attributed checkout value
 * - delivered: sum of expected COD for uniquely delivered orders (excludes RTO shipments)
 * - collected: provisional door cash (may be assumed on delivered)
 * - settled: reconciled cash after Conciliación (CSV / Ecart Pay) — product ROAS truth
 */
export function computeDashboardRevenueTotals(input: {
  orders: readonly DashboardRevenueOrder[];
  shipments: readonly DashboardRevenueShipment[];
  checkoutRevenue: number;
  spend: number;
}): DashboardRevenueTotals {
  const ordersById = new Map(input.orders.map((order) => [order.id, order]));

  const deliveredOrderIds = new Set<string>();
  for (const shipment of input.shipments) {
    if (shipment.status === "delivered" && !shipment.is_rto) {
      deliveredOrderIds.add(shipment.order_id);
    }
  }

  let deliveredRevenue = 0;
  for (const orderId of deliveredOrderIds) {
    const order = ordersById.get(orderId);
    if (order) deliveredRevenue += orderDeliveredValue(order);
  }

  const collectedRevenue = input.orders
    .filter(isCashCollectedOrder)
    .reduce((total, order) => total + (order.collected_cod_amount ?? 0), 0);

  const settledRevenue = input.orders
    .filter(isSettledOrder)
    .reduce((total, order) => total + (order.settled_cod_amount ?? 0), 0);

  const { checkoutRevenue, spend } = input;
  return {
    checkoutRevenue,
    deliveredRevenue,
    collectedRevenue,
    settledRevenue,
    spend,
    roasCheckout: roasRatio(checkoutRevenue, spend),
    roasDelivered: roasRatio(deliveredRevenue, spend),
    roasCollected: roasRatio(collectedRevenue, spend),
    roasSettled: roasRatio(settledRevenue, spend),
  };
}
