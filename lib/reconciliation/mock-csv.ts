/**
 * Deterministic mock CSV scenarios for Sprint 5 reconciliation smoke tests.
 * Generate sample CSV text covering: exact match, lower amount, unexpected fee,
 * unknown tracking, duplicate, missing payment, and correct liquidation.
 */

export function generateMockSettlementCsv(options?: {
  trackingExact?: string;
  orderNumber?: string;
  expectedAmount?: number;
}): string {
  const tracking = options?.trackingExact ?? "TRK-EXACT-001";
  const orderNumber = options?.orderNumber ?? "ORD-1001";
  const expected = options?.expectedAmount ?? 150;

  const headers = [
    "tracking",
    "order_number",
    "external_order_id",
    "external_shipment_id",
    "gross_amount",
    "fee_amount",
    "net_amount",
    "currency",
    "date",
    "reference",
  ];

  const rows: string[][] = [
    // exact match
    [tracking, orderNumber, "", "", String(expected), "5", String(expected - 5), "PEN", "2026-07-01", "exact"],
    // amount lower
    ["TRK-LOW-002", "ORD-1002", "", "", String(expected - 20), "5", String(expected - 25), "PEN", "2026-07-01", "lower"],
    // unexpected fee
    ["TRK-FEE-003", "ORD-1003", "", "", String(expected), "40", String(expected - 40), "PEN", "2026-07-01", "fee"],
    // unknown tracking
    ["TRK-UNKNOWN-999", "", "", "", "99", "3", "96", "PEN", "2026-07-01", "unknown"],
    // duplicate of exact
    [tracking, orderNumber, "", "", String(expected), "5", String(expected - 5), "PEN", "2026-07-01", "dup"],
    // missing payment key only amount (will fail validation / unmatched)
    ["", "", "", "", "80", "2", "78", "PEN", "2026-07-01", "missing_key"],
    // correct liquidation via external ids
    ["", "ORD-1004", "EXT-ORD-4", "EXT-SHIP-4", "200", "8", "192", "PEN", "2026-07-02", "ok_liq"],
  ];

  return [headers.join(","), ...rows.map((r) => r.map(csvEscape).join(","))].join("\n");
}

function csvEscape(value: string): string {
  if (/[",\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}
