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

const DEFAULT_STORE_TIMEZONE = "America/Lima";

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

function zonedYmd(date: Date, timeZone: string): { y: number; m: number; d: number } {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const read = (type: Intl.DateTimeFormatPartTypes): number => {
    const part = parts.find((entry) => entry.type === type);
    return part ? Number(part.value) : 0;
  };
  return { y: read("year"), m: read("month"), d: read("day") };
}

/**
 * Stable YYYY-MM-DD key from an ISO timestamp in the store timezone
 * (falls back to America/Lima). Pass timeZone=UTC for UTC calendar days.
 */
export function dayKey(value: string | Date, timeZone: string = DEFAULT_STORE_TIMEZONE): string {
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return "";
  const tz = timeZone.trim() || DEFAULT_STORE_TIMEZONE;
  if (tz === "UTC" || tz === "Etc/UTC") {
    const y = date.getUTCFullYear();
    const m = String(date.getUTCMonth() + 1).padStart(2, "0");
    const d = String(date.getUTCDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }
  const { y, m, d } = zonedYmd(date, tz);
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

export function previousPeriodBounds(fromIso: string, toIso: string): { from: string; to: string } {
  const from = new Date(fromIso);
  const to = new Date(toIso);
  const durationMs = Math.max(to.getTime() - from.getTime(), 0);
  const previousTo = new Date(from.getTime());
  const previousFrom = new Date(from.getTime() - durationMs);
  return { from: previousFrom.toISOString(), to: previousTo.toISOString() };
}

/**
 * Continuous calendar day keys from `from`..`to` inclusive, using store timezone
 * for the range endpoints. Intermediate keys are consecutive YYYY-MM-DD strings.
 */
export function eachDayKey(
  fromIso: string,
  toIso: string,
  timeZone: string = DEFAULT_STORE_TIMEZONE,
): string[] {
  const start = dayKey(fromIso, timeZone);
  const end = dayKey(toIso, timeZone);
  if (!start || !end) return [];
  const keys: string[] = [];
  // Noon UTC avoids DST edge cases when stepping calendar dates as plain YMD.
  const cursor = new Date(`${start}T12:00:00.000Z`);
  const last = new Date(`${end}T12:00:00.000Z`);
  while (cursor <= last) {
    const y = cursor.getUTCFullYear();
    const m = String(cursor.getUTCMonth() + 1).padStart(2, "0");
    const d = String(cursor.getUTCDate()).padStart(2, "0");
    keys.push(`${y}-${m}-${d}`);
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
    cashSettled: 0,
    adSpend: 0,
    checkoutRevenue: 0,
    deliveredRevenue: 0,
    rto: 0,
    roasCheckout: 0,
    roasDelivered: 0,
    roasCollected: 0,
    roasSettled: 0,
  };
}
