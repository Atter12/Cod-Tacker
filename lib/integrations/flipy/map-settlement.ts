import { normalizeFlipyOrderExternalId } from "@/lib/integrations/flipy/map-webhook";
import type { FlipySettlementBatch, FlipySettlementItem } from "@/lib/integrations/flipy/partner-contract";
import { parseCsv } from "@/lib/reconciliation/csv";

/** Row shape expected by settlement.csv.imported / flipy.synced job payload. */
export type FlipySettlementImportRow = {
  sourceRowNumber: number;
  trackingNumber: string | null;
  externalShipmentId: string | null;
  externalOrderId: string | null;
  orderNumber: string | null;
  grossAmount: number;
  feeAmount: number;
  netAmount: number;
  currencyCode: string;
  occurredAt: string | null;
  reference: string | null;
  rawRow: Record<string, string>;
  duplicateInFile?: boolean;
};

function asString(value: unknown): string | null {
  if (typeof value === "string" && value.trim()) return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return null;
}

function asNumber(value: unknown, fallback = 0): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const n = Number(value.replace(/,/g, ""));
    if (Number.isFinite(n)) return n;
  }
  return fallback;
}

function mapItem(
  item: FlipySettlementItem,
  sourceRowNumber: number,
  fallbackCurrency: string,
): FlipySettlementImportRow | null {
  if (item.grossAmount <= 0) return null;
  const externalRaw = item.externalOrderId?.trim() || null;
  const externalOrderId = externalRaw
    ? normalizeFlipyOrderExternalId(externalRaw) || externalRaw
    : null;
  const currency = (item.currency ?? fallbackCurrency).toUpperCase().slice(0, 3) || "PEN";
  return {
    sourceRowNumber,
    trackingNumber: item.tracking?.trim() || null,
    externalShipmentId: item.envioId?.trim() || null,
    externalOrderId,
    orderNumber: item.orderNumber?.trim() || null,
    grossAmount: item.grossAmount,
    feeAmount: item.feeAmount,
    netAmount: item.netAmount,
    currencyCode: currency,
    occurredAt: item.collectedAt?.trim() || null,
    reference: item.reference?.trim() || null,
    rawRow: {
      tracking: item.tracking ?? "",
      order_number: item.orderNumber ?? "",
      external_order_id: externalRaw ?? "",
      external_shipment_id: item.envioId ?? "",
      gross_amount: String(item.grossAmount),
      fee_amount: String(item.feeAmount),
      net_amount: String(item.netAmount),
      currency,
      date: item.collectedAt ?? "",
      reference: item.reference ?? "",
    },
  };
}

/** Map Partner settlement batch → job rows (preset flipy_cod keys). */
export function mapFlipySettlementBatchToImportRows(
  batch: FlipySettlementBatch,
): FlipySettlementImportRow[] {
  const rows: FlipySettlementImportRow[] = [];
  let n = 0;
  for (const item of batch.items) {
    n += 1;
    const mapped = mapItem(item, n, batch.currency);
    if (mapped) rows.push(mapped);
  }
  return rows;
}

/**
 * Parse Flipy Partner CSV export (`format=settlement`) into import rows.
 * Headers aligned with preset flipy_cod.
 */
export function mapFlipySettlementCsvToImportRows(csvText: string): FlipySettlementImportRow[] {
  const { headers, rows } = parseCsv(csvText);
  if (!headers.length || !rows.length) return [];

  const idx = (name: string) => {
    const i = headers.findIndex((h) => h.trim().toLowerCase() === name.toLowerCase());
    return i >= 0 ? i : -1;
  };
  const col = {
    tracking: idx("tracking"),
    orderNumber: idx("order_number"),
    externalOrderId: idx("external_order_id"),
    externalShipmentId: idx("external_shipment_id"),
    gross: idx("gross_amount"),
    fee: idx("fee_amount"),
    net: idx("net_amount"),
    currency: idx("currency"),
    date: idx("date"),
    reference: idx("reference"),
  };

  const out: FlipySettlementImportRow[] = [];
  let n = 0;
  for (const cells of rows) {
    const get = (i: number) => (i >= 0 ? asString(cells[i]) : null);
    const gross = asNumber(col.gross >= 0 ? cells[col.gross] : 0, 0);
    if (gross <= 0) continue;
    const fee = asNumber(col.fee >= 0 ? cells[col.fee] : 0, 0);
    const net = col.net >= 0 ? asNumber(cells[col.net], Math.max(0, gross - fee)) : Math.max(0, gross - fee);
    const externalRaw = get(col.externalOrderId);
    const externalOrderId = externalRaw
      ? normalizeFlipyOrderExternalId(externalRaw) || externalRaw
      : null;
    const currency = (get(col.currency) ?? "PEN").toUpperCase().slice(0, 3);
    n += 1;
    out.push({
      sourceRowNumber: n,
      trackingNumber: get(col.tracking),
      externalShipmentId: get(col.externalShipmentId),
      externalOrderId,
      orderNumber: get(col.orderNumber),
      grossAmount: gross,
      feeAmount: fee,
      netAmount: net,
      currencyCode: currency,
      occurredAt: get(col.date),
      reference: get(col.reference),
      rawRow: Object.fromEntries(headers.map((h, i) => [h, cells[i] ?? ""])),
    });
  }
  return out;
}
