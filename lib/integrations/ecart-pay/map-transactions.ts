import type { EcartPayTransaction } from "@/lib/integrations/ecart-pay/api";

export type EcartSettlementRow = {
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

function asNumber(value: unknown, fallback = 0): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const n = Number(value.replace(/,/g, ""));
    if (Number.isFinite(n)) return n;
  }
  return fallback;
}

function asString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const t = value.trim();
  return t ? t : null;
}

function metaString(meta: Record<string, unknown> | undefined, keys: string[]): string | null {
  if (!meta) return null;
  for (const key of keys) {
    const v = meta[key];
    const s = asString(v);
    if (s) return s;
    if (typeof v === "number" && Number.isFinite(v)) return String(v);
  }
  return null;
}

/**
 * Map Ecart Pay transactions into settlement import rows for the shared matcher.
 * Paid / completed COD-like payments only; skips empty amounts.
 */
export function mapEcartTransactionsToSettlementRows(
  transactions: EcartPayTransaction[],
): EcartSettlementRow[] {
  const rows: EcartSettlementRow[] = [];
  let rowNumber = 0;

  for (const tx of transactions) {
    const status = (asString(tx.status) ?? "").toLowerCase();
    if (status && !["paid", "completed", "success", "approved", "captured"].includes(status)) {
      continue;
    }

    const gross = asNumber(tx.amount ?? tx.total, 0);
    if (gross <= 0) continue;

    const fee = asNumber(tx.fee ?? tx.fees, 0);
    const net = Math.max(0, gross - fee);
    const currency = (asString(tx.currency) ?? "PEN").toUpperCase().slice(0, 3);
    const meta = tx.metadata && typeof tx.metadata === "object" ? tx.metadata : undefined;

    const orderNumber =
      asString(tx.order_id) ??
      asString(tx.orderId) ??
      asString(tx.reference) ??
      metaString(meta, ["order_number", "orderNumber", "shopify_order_number", "pedido"]);
    const externalOrderId =
      metaString(meta, ["external_order_id", "shopify_order_id", "order_id"]) ?? orderNumber;
    const trackingNumber =
      asString(tx.tracking_number) ??
      asString(tx.trackingNumber) ??
      metaString(meta, ["tracking_number", "tracking", "guia"]);

    const id = asString(tx.id) ?? asString(tx._id) ?? `row-${rowNumber + 1}`;
    const occurredAt = asString(tx.created_at) ?? asString(tx.createdAt);

    rowNumber += 1;
    rows.push({
      sourceRowNumber: rowNumber,
      trackingNumber,
      externalShipmentId: null,
      externalOrderId,
      orderNumber,
      grossAmount: gross,
      feeAmount: fee,
      netAmount: net,
      currencyCode: currency.length === 3 ? currency : "PEN",
      occurredAt,
      reference: asString(tx.description) ?? asString(tx.reference) ?? id,
      rawRow: {
        id,
        status: asString(tx.status) ?? "",
        type: asString(tx.type) ?? "",
        amount: String(gross),
        fee: String(fee),
        currency,
        order_number: orderNumber ?? "",
        tracking: trackingNumber ?? "",
        created_at: occurredAt ?? "",
      },
    });
  }

  return rows;
}
