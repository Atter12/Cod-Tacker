/** CSV column presets and mapped settlement row shape for Sprint 5 import. */

export type SettlementCsvColumnKey =
  | "tracking_number"
  | "external_shipment_id"
  | "external_order_id"
  | "order_number"
  | "gross_amount"
  | "fee_amount"
  | "net_amount"
  | "currency_code"
  | "occurred_at"
  | "reference";

export type ColumnMapping = Partial<Record<SettlementCsvColumnKey, string>>;

export type CarrierCsvPreset = {
  id: string;
  label: string;
  mapping: ColumnMapping;
};

export const CARRIER_CSV_PRESETS: CarrierCsvPreset[] = [
  {
    id: "generic_cod",
    label: "Genérico COD",
    mapping: {
      tracking_number: "tracking",
      order_number: "order_number",
      external_order_id: "external_order_id",
      external_shipment_id: "external_shipment_id",
      gross_amount: "gross_amount",
      fee_amount: "fee_amount",
      net_amount: "net_amount",
      currency_code: "currency",
      occurred_at: "date",
      reference: "reference",
    },
  },
  {
    id: "olva_style",
    label: "Estilo Olva / tracking-first",
    mapping: {
      tracking_number: "guia",
      order_number: "pedido",
      gross_amount: "monto_cobrado",
      fee_amount: "comision",
      net_amount: "neto",
      currency_code: "moneda",
      occurred_at: "fecha",
    },
  },
  {
    id: "shalo_style",
    label: "Estilo Shalo / order-first",
    mapping: {
      order_number: "nro_pedido",
      external_order_id: "id_externo",
      tracking_number: "tracking",
      gross_amount: "importe",
      fee_amount: "fee",
      currency_code: "currency",
      occurred_at: "settled_at",
    },
  },
];

export const MAX_CSV_BYTES = 2 * 1024 * 1024; // 2 MiB
export const MAX_CSV_ROWS = 500;
export const ALLOWED_CSV_MIME = new Set([
  "text/csv",
  "application/csv",
  "text/plain",
  "application/vnd.ms-excel",
]);

export function getPreset(id: string): CarrierCsvPreset | undefined {
  return CARRIER_CSV_PRESETS.find((p) => p.id === id);
}
