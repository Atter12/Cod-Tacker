/** Confirmed once the order passed confirmation or reached a post-confirmation lifecycle state. */
const CONFIRMED_ORDER_STATUSES = new Set([
  "confirmed",
  "ready_to_ship",
  "shipped",
  "in_transit",
  "out_for_delivery",
  "delivered",
  "delivery_failed",
  "return_in_transit",
  "returned",
  "lost",
  "closed",
]);

export function isOrderConfirmed(order: {
  confirmed_at: string | null;
  confirmation_status: string;
  order_status: string;
}): boolean {
  if (order.confirmed_at) return true;
  if (order.confirmation_status === "confirmed") return true;
  return CONFIRMED_ORDER_STATUSES.has(order.order_status);
}

export function ratio(numerator: number, denominator: number): number {
  return denominator ? numerator / denominator : 0;
}

export function changePercent(current: number, previous: number): number | null {
  if (previous === 0 && current === 0) return 0;
  if (previous === 0) return null;
  const value = ((current - previous) / Math.abs(previous)) * 100;
  if (!Number.isFinite(value)) return null;
  return value;
}

export function toMetric(current: number, previous: number) {
  return {
    value: current,
    previousValue: previous,
    changePercent: changePercent(current, previous),
  };
}

/** Stable YYYY-MM-DD key from an ISO timestamp using UTC calendar parts (matches toISOString bounds). */
export function dayKey(value: string | Date): string {
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return "";
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function previousPeriodBounds(fromIso: string, toIso: string): { from: string; to: string } {
  const from = new Date(fromIso);
  const to = new Date(toIso);
  const durationMs = Math.max(to.getTime() - from.getTime(), 0);
  const previousTo = new Date(from.getTime());
  const previousFrom = new Date(from.getTime() - durationMs);
  return { from: previousFrom.toISOString(), to: previousTo.toISOString() };
}

export function eachDayKey(fromIso: string, toIso: string): string[] {
  const start = dayKey(fromIso);
  const end = dayKey(toIso);
  if (!start || !end) return [];
  const keys: string[] = [];
  const cursor = new Date(`${start}T00:00:00.000Z`);
  const last = new Date(`${end}T00:00:00.000Z`);
  while (cursor <= last) {
    keys.push(dayKey(cursor));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return keys;
}

export function emptySeriesPoint(date: string) {
  return {
    date,
    ordersGenerated: 0,
    ordersConfirmed: 0,
    ordersDelivered: 0,
    ordersReturned: 0,
    cashCollected: 0,
    adSpend: 0,
    checkoutRevenue: 0,
    deliveredRevenue: 0,
    rto: 0,
    roasCheckout: 0,
    roasDelivered: 0,
    roasCollected: 0,
  };
}
