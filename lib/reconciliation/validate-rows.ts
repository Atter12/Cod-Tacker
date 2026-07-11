import type { ColumnMapping, SettlementCsvColumnKey } from "@/lib/reconciliation/presets";
import { MAX_CSV_ROWS } from "@/lib/reconciliation/presets";

export type ValidatedSettlementRow = {
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
};

export type RowValidationError = {
  sourceRowNumber: number;
  field?: string;
  code: string;
  message: string;
};

export type ValidateSettlementRowsResult = {
  rows: ValidatedSettlementRow[];
  errors: RowValidationError[];
  duplicateKeys: string[];
};

const AMOUNT_KEYS: SettlementCsvColumnKey[] = ["gross_amount", "fee_amount", "net_amount"];

function pick(mapping: ColumnMapping, key: SettlementCsvColumnKey, raw: Record<string, string>): string {
  const header = mapping[key];
  if (!header) return "";
  // Case-insensitive header match
  const found = Object.keys(raw).find((k) => k.toLowerCase() === header.toLowerCase());
  return found ? (raw[found] ?? "").trim() : "";
}

function parseAmount(value: string): number | null {
  if (!value) return null;
  const normalized = value.replace(/\s/g, "").replace(/,/g, "");
  const n = Number(normalized);
  if (!Number.isFinite(n)) return null;
  return n;
}

function parseDate(value: string): string | null {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

function fingerprint(row: ValidatedSettlementRow): string | null {
  const tracking = row.trackingNumber?.toLowerCase();
  if (tracking) return `t:${tracking}`;
  const extShip = row.externalShipmentId?.toLowerCase();
  if (extShip) return `s:${extShip}`;
  const extOrder = row.externalOrderId?.toLowerCase();
  if (extOrder) return `o:${extOrder}`;
  const orderNo = row.orderNumber?.toLowerCase();
  if (orderNo) return `n:${orderNo}:${row.grossAmount}`;
  return null;
}

/**
 * Validate mapped CSV objects into settlement rows.
 * Does not persist; returns per-row errors and in-file duplicate keys.
 */
export function validateSettlementRows(
  objects: Record<string, string>[],
  mapping: ColumnMapping,
  options?: { defaultCurrency?: string; maxRows?: number },
): ValidateSettlementRowsResult {
  const defaultCurrency = (options?.defaultCurrency ?? "PEN").toUpperCase();
  const maxRows = options?.maxRows ?? MAX_CSV_ROWS;
  const errors: RowValidationError[] = [];
  const rows: ValidatedSettlementRow[] = [];
  const seen = new Map<string, number>();
  const duplicateKeys: string[] = [];

  if (objects.length > maxRows) {
    errors.push({
      sourceRowNumber: 0,
      code: "TOO_MANY_ROWS",
      message: `El archivo supera el máximo de ${maxRows} filas.`,
    });
  }

  const limit = Math.min(objects.length, maxRows);
  for (let i = 0; i < limit; i++) {
    const raw = objects[i]!;
    const sourceRowNumber = i + 2; // header is row 1
    const trackingNumber = pick(mapping, "tracking_number", raw) || null;
    const externalShipmentId = pick(mapping, "external_shipment_id", raw) || null;
    const externalOrderId = pick(mapping, "external_order_id", raw) || null;
    const orderNumber = pick(mapping, "order_number", raw) || null;
    const currencyRaw = pick(mapping, "currency_code", raw).toUpperCase() || defaultCurrency;
    const occurredAt = parseDate(pick(mapping, "occurred_at", raw));
    const reference = pick(mapping, "reference", raw) || null;

    const grossParsed = parseAmount(pick(mapping, "gross_amount", raw));
    const feeParsed = parseAmount(pick(mapping, "fee_amount", raw)) ?? 0;
    let netParsed = parseAmount(pick(mapping, "net_amount", raw));

    if (!trackingNumber && !externalShipmentId && !externalOrderId && !orderNumber) {
      errors.push({
        sourceRowNumber,
        code: "MISSING_KEY",
        message: "Falta tracking, ID de envío/pedido o número de pedido.",
      });
      continue;
    }

    if (grossParsed == null) {
      errors.push({
        sourceRowNumber,
        field: "gross_amount",
        code: "INVALID_AMOUNT",
        message: "Monto bruto inválido o ausente.",
      });
      continue;
    }

    if (grossParsed < 0 || feeParsed < 0) {
      errors.push({
        sourceRowNumber,
        code: "NEGATIVE_AMOUNT",
        message: "Los montos no pueden ser negativos.",
      });
      continue;
    }

    if (currencyRaw.length !== 3 || !/^[A-Z]{3}$/.test(currencyRaw)) {
      errors.push({
        sourceRowNumber,
        field: "currency_code",
        code: "INVALID_CURRENCY",
        message: `Moneda inválida: ${currencyRaw}`,
      });
      continue;
    }

    if (netParsed == null) netParsed = grossParsed - feeParsed;
    if (Math.abs(netParsed - (grossParsed - feeParsed)) > 0.05) {
      // Soft warning kept as difference candidate later; still accept row.
    }

    const row: ValidatedSettlementRow = {
      sourceRowNumber,
      trackingNumber,
      externalShipmentId,
      externalOrderId,
      orderNumber,
      grossAmount: grossParsed,
      feeAmount: feeParsed,
      netAmount: netParsed,
      currencyCode: currencyRaw,
      occurredAt,
      reference,
      rawRow: sanitizeRawRow(raw),
    };

    const fp = fingerprint(row);
    if (fp) {
      if (seen.has(fp)) {
        duplicateKeys.push(fp);
        errors.push({
          sourceRowNumber,
          code: "DUPLICATE_IN_FILE",
          message: `Fila duplicada respecto a la fila ${seen.get(fp)}.`,
        });
      } else {
        seen.set(fp, sourceRowNumber);
      }
    }

    rows.push(row);
  }

  void AMOUNT_KEYS;
  return { rows, errors, duplicateKeys: [...new Set(duplicateKeys)] };
}

/** Strip oversized / dangerous values before storing as jsonb. */
export function sanitizeRawRow(raw: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(raw)) {
    if (k.length > 80) continue;
    out[k.slice(0, 80)] = String(v).slice(0, 500);
  }
  return out;
}
