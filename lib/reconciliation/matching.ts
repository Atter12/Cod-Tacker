/**
 * Deterministic settlement matching engine.
 *
 * Priority:
 * 1. tracking exact
 * 2. external shipment / order ID
 * 3. order_number
 * 4. amount + time window → suggestion only (never high-confidence auto-match)
 */

export type SettlementMatchMethod =
  | "tracking"
  | "external_shipment_id"
  | "external_order_id"
  | "order_number"
  | "amount_time_suggestion"
  | "manual";

export type SettlementMatchStatus =
  | "matched"
  | "unmatched"
  | "difference"
  | "duplicate"
  | "disputed"
  | "resolved";

export type MatchCandidateOrder = {
  id: string;
  orderNumber: string | null;
  externalOrderId: string | null;
  expectedCodAmount: number | null;
  collectedCodAmount: number | null;
  currencyCode: string | null;
  createdAt: string;
  deliveredAt: string | null;
};

export type MatchCandidateShipment = {
  id: string;
  orderId: string | null;
  trackingNumber: string | null;
  externalShipmentId: string | null;
};

export type MatchInputRow = {
  sourceRowNumber: number;
  trackingNumber: string | null;
  externalShipmentId: string | null;
  externalOrderId: string | null;
  orderNumber: string | null;
  grossAmount: number;
  feeAmount: number;
  currencyCode: string;
  occurredAt: string | null;
  /** When true, mark as duplicate even if a domain match exists. */
  duplicateInFile?: boolean;
};

export type MatchResult = {
  sourceRowNumber: number;
  matchStatus: SettlementMatchStatus;
  matchMethod: SettlementMatchMethod | null;
  matchConfidence: number;
  orderId: string | null;
  shipmentId: string | null;
  expectedAmount: number | null;
  differenceAmount: number | null;
  discrepancyReason: string | null;
};

const AMOUNT_TOLERANCE = 0.01;
const SUGGESTION_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;
const FEE_UNEXPECTED_THRESHOLD = 0.15; // relative to gross

function norm(value: string | null | undefined): string | null {
  if (!value) return null;
  const t = value.trim().toLowerCase();
  return t || null;
}

function amountDiff(a: number, b: number): number {
  return Math.round((a - b) * 100) / 100;
}

function expectedForOrder(order: MatchCandidateOrder): number {
  return order.expectedCodAmount ?? order.collectedCodAmount ?? 0;
}

/**
 * Match a single CSV row against in-memory order/shipment indexes for a store.
 * Caller must pre-filter to the same store (tenant isolation).
 */
export function matchSettlementRow(
  row: MatchInputRow,
  orders: MatchCandidateOrder[],
  shipments: MatchCandidateShipment[],
  alreadyMatchedOrderIds: Set<string>,
): MatchResult {
  if (row.duplicateInFile) {
    return {
      sourceRowNumber: row.sourceRowNumber,
      matchStatus: "duplicate",
      matchMethod: null,
      matchConfidence: 1,
      orderId: null,
      shipmentId: null,
      expectedAmount: null,
      differenceAmount: null,
      discrepancyReason: "duplicate_in_file",
    };
  }

  const byTracking = new Map<string, MatchCandidateShipment>();
  const byExtShip = new Map<string, MatchCandidateShipment>();
  for (const s of shipments) {
    const t = norm(s.trackingNumber);
    if (t) byTracking.set(t, s);
    const e = norm(s.externalShipmentId);
    if (e) byExtShip.set(e, s);
  }

  const byOrderNumber = new Map<string, MatchCandidateOrder>();
  const byExtOrder = new Map<string, MatchCandidateOrder>();
  for (const o of orders) {
    const n = norm(o.orderNumber);
    if (n) byOrderNumber.set(n, o);
    const e = norm(o.externalOrderId);
    if (e) byExtOrder.set(e, o);
  }

  let method: SettlementMatchMethod | null = null;
  let confidence = 0;
  let order: MatchCandidateOrder | null = null;
  let shipment: MatchCandidateShipment | null = null;

  const tracking = norm(row.trackingNumber);
  if (tracking && byTracking.has(tracking)) {
    shipment = byTracking.get(tracking)!;
    order = orders.find((o) => o.id === shipment!.orderId) ?? null;
    method = "tracking";
    confidence = 1;
  }

  if (!order) {
    const extShip = norm(row.externalShipmentId);
    if (extShip && byExtShip.has(extShip)) {
      shipment = byExtShip.get(extShip)!;
      order = orders.find((o) => o.id === shipment!.orderId) ?? null;
      method = "external_shipment_id";
      confidence = 0.98;
    }
  }

  if (!order) {
    const extOrder = norm(row.externalOrderId);
    if (extOrder && byExtOrder.has(extOrder)) {
      order = byExtOrder.get(extOrder)!;
      shipment = shipments.find((s) => s.orderId === order!.id) ?? null;
      method = "external_order_id";
      confidence = 0.95;
    }
  }

  if (!order) {
    const orderNo = norm(row.orderNumber);
    if (orderNo && byOrderNumber.has(orderNo)) {
      order = byOrderNumber.get(orderNo)!;
      shipment = shipments.find((s) => s.orderId === order!.id) ?? null;
      method = "order_number";
      confidence = 0.9;
    }
  }

  // Amount + time suggestion only — never auto high-confidence match.
  if (!order) {
    const anchor = row.occurredAt ? Date.parse(row.occurredAt) : NaN;
    const suggestions = orders.filter((o) => {
      if (alreadyMatchedOrderIds.has(o.id)) return false;
      const expected = expectedForOrder(o);
      if (Math.abs(expected - row.grossAmount) > AMOUNT_TOLERANCE) return false;
      if (!Number.isFinite(anchor)) return true;
      const t = Date.parse(o.deliveredAt ?? o.createdAt);
      if (!Number.isFinite(t)) return false;
      return Math.abs(t - anchor) <= SUGGESTION_WINDOW_MS;
    });
    if (suggestions.length === 1) {
      return {
        sourceRowNumber: row.sourceRowNumber,
        matchStatus: "unmatched",
        matchMethod: "amount_time_suggestion",
        matchConfidence: 0.4,
        orderId: suggestions[0]!.id,
        shipmentId: shipments.find((s) => s.orderId === suggestions[0]!.id)?.id ?? null,
        expectedAmount: expectedForOrder(suggestions[0]!),
        differenceAmount: amountDiff(row.grossAmount, expectedForOrder(suggestions[0]!)),
        discrepancyReason: "amount_time_suggestion_requires_manual_confirm",
      };
    }
    return {
      sourceRowNumber: row.sourceRowNumber,
      matchStatus: "unmatched",
      matchMethod: null,
      matchConfidence: 0,
      orderId: null,
      shipmentId: null,
      expectedAmount: null,
      differenceAmount: null,
      discrepancyReason: "no_match",
    };
  }

  if (alreadyMatchedOrderIds.has(order.id)) {
    return {
      sourceRowNumber: row.sourceRowNumber,
      matchStatus: "duplicate",
      matchMethod: method,
      matchConfidence: confidence,
      orderId: order.id,
      shipmentId: shipment?.id ?? null,
      expectedAmount: expectedForOrder(order),
      differenceAmount: amountDiff(row.grossAmount, expectedForOrder(order)),
      discrepancyReason: "order_already_matched_in_batch",
    };
  }

  const expected = expectedForOrder(order);
  const diff = amountDiff(row.grossAmount, expected);
  const feeRatio = row.grossAmount > 0 ? row.feeAmount / row.grossAmount : 0;

  if (Math.abs(diff) > AMOUNT_TOLERANCE) {
    return {
      sourceRowNumber: row.sourceRowNumber,
      matchStatus: "difference",
      matchMethod: method,
      matchConfidence: confidence,
      orderId: order.id,
      shipmentId: shipment?.id ?? null,
      expectedAmount: expected,
      differenceAmount: diff,
      discrepancyReason: diff < 0 ? "amount_lower_than_expected" : "amount_higher_than_expected",
    };
  }

  if (feeRatio > FEE_UNEXPECTED_THRESHOLD) {
    return {
      sourceRowNumber: row.sourceRowNumber,
      matchStatus: "difference",
      matchMethod: method,
      matchConfidence: confidence,
      orderId: order.id,
      shipmentId: shipment?.id ?? null,
      expectedAmount: expected,
      differenceAmount: 0,
      discrepancyReason: "unexpected_fee",
    };
  }

  return {
    sourceRowNumber: row.sourceRowNumber,
    matchStatus: "matched",
    matchMethod: method,
    matchConfidence: confidence,
    orderId: order.id,
    shipmentId: shipment?.id ?? null,
    expectedAmount: expected,
    differenceAmount: 0,
    discrepancyReason: null,
  };
}

export function matchSettlementRows(
  rows: MatchInputRow[],
  orders: MatchCandidateOrder[],
  shipments: MatchCandidateShipment[],
): MatchResult[] {
  const claimed = new Set<string>();
  const results: MatchResult[] = [];
  for (const row of rows) {
    const result = matchSettlementRow(row, orders, shipments, claimed);
    if (
      result.orderId &&
      (result.matchStatus === "matched" ||
        result.matchStatus === "difference" ||
        result.matchStatus === "duplicate")
    ) {
      // Only claim high-confidence auto matches for uniqueness of subsequent rows.
      if (result.matchStatus === "matched" || result.matchStatus === "difference") {
        claimed.add(result.orderId);
      }
    }
    results.push(result);
  }
  return results;
}

/** Map item match_status → batch reconciliation_status rollup. */
export function rollupBatchStatus(
  statuses: SettlementMatchStatus[],
): "open" | "partially_matched" | "matched" | "disputed" | "closed" {
  if (statuses.length === 0) return "open";
  const set = new Set(statuses);
  if (set.has("disputed")) return "disputed";
  if ([...set].every((s) => s === "matched" || s === "resolved")) return "matched";
  if (set.has("matched") || set.has("difference") || set.has("resolved")) return "partially_matched";
  return "open";
}
