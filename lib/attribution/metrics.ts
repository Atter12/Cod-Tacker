/**
 * Advertising / attribution KPI formulas (Sprint 6).
 *
 * Denominators:
 * - ROAS* = value / spend. If spend <= 0 → null (not 0, to avoid fake infinity).
 * - Rates = numerator / denominator. If denominator <= 0 → null.
 *
 * ROAS variants:
 * - generated: attributed checkout/generated revenue ÷ spend
 * - delivered: order total where order_status=delivered (excludes returned) ÷ spend
 * - collected: collected_cod_amount ÷ spend
 * - settled (conciliado): settled_cod_amount ÷ spend
 *
 * RTO rate = returned (or is_rto) / total shipments in scope.
 * Confirmation rate = confirmed / orders.
 * Delivery rate = delivered / shipped (or confirmed if shipped=0 → null).
 */

export type AdsKpisInput = {
  spend: number;
  impressions?: number;
  clicks?: number;
  ordersGenerated: number;
  ordersConfirmed: number;
  ordersShipped: number;
  ordersDelivered: number;
  ordersRejected: number;
  ordersReturned: number;
  revenueGenerated: number;
  deliveredValue: number;
  collectedValue: number;
  settledValue: number;
  marginAmount?: number | null;
  avgConfidence?: number | null;
};

export type AdsKpis = {
  spend: number;
  impressions: number;
  clicks: number;
  ordersGenerated: number;
  ordersConfirmed: number;
  ordersShipped: number;
  ordersDelivered: number;
  ordersRejected: number;
  ordersReturned: number;
  revenueGenerated: number;
  deliveredValue: number;
  collectedValue: number;
  settledValue: number;
  roasGenerated: number | null;
  roasDelivered: number | null;
  roasCollected: number | null;
  roasSettled: number | null;
  confirmationRate: number | null;
  deliveryRate: number | null;
  rtoRate: number | null;
  margin: number | null;
  avgConfidence: number | null;
  ctr: number | null;
};

function safeDiv(numerator: number, denominator: number): number | null {
  if (!Number.isFinite(numerator) || !Number.isFinite(denominator)) return null;
  if (denominator <= 0) return null;
  return numerator / denominator;
}

function round4(n: number | null): number | null {
  if (n == null || !Number.isFinite(n)) return null;
  return Math.round(n * 10000) / 10000;
}

/** Delivered value must exclude returned orders (caller responsibility). */
export function computeAdsKpis(input: AdsKpisInput): AdsKpis {
  const spend = input.spend;
  const impressions = input.impressions ?? 0;
  const clicks = input.clicks ?? 0;

  return {
    spend,
    impressions,
    clicks,
    ordersGenerated: input.ordersGenerated,
    ordersConfirmed: input.ordersConfirmed,
    ordersShipped: input.ordersShipped,
    ordersDelivered: input.ordersDelivered,
    ordersRejected: input.ordersRejected,
    ordersReturned: input.ordersReturned,
    revenueGenerated: input.revenueGenerated,
    deliveredValue: input.deliveredValue,
    collectedValue: input.collectedValue,
    settledValue: input.settledValue,
    roasGenerated: round4(safeDiv(input.revenueGenerated, spend)),
    roasDelivered: round4(safeDiv(input.deliveredValue, spend)),
    roasCollected: round4(safeDiv(input.collectedValue, spend)),
    roasSettled: round4(safeDiv(input.settledValue, spend)),
    confirmationRate: round4(safeDiv(input.ordersConfirmed, input.ordersGenerated)),
    deliveryRate: round4(safeDiv(input.ordersDelivered, input.ordersShipped)),
    rtoRate: round4(
      safeDiv(input.ordersReturned, input.ordersShipped > 0 ? input.ordersShipped : input.ordersGenerated),
    ),
    margin: input.marginAmount ?? null,
    avgConfidence: input.avgConfidence ?? null,
    ctr: round4(safeDiv(clicks, impressions)),
  };
}

export function formatRoas(value: number | null): string {
  if (value == null) return "—";
  return `${value.toFixed(2)}x`;
}

export function formatRate(value: number | null): string {
  if (value == null) return "—";
  return `${(value * 100).toFixed(1)}%`;
}
