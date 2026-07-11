/** Spanish labels for reconciliation / settlement match statuses. */

import type { Enums } from "@/types/database.generated";

export type ReconciliationStatus = Enums<"reconciliation_status">;
export type SettlementMatchStatus = Enums<"settlement_match_status">;
export type SettlementMatchMethod = Enums<"settlement_match_method">;

const BATCH_LABELS: Record<ReconciliationStatus, string> = {
  open: "Abierto",
  partially_matched: "Parcialmente conciliado",
  matched: "Conciliado",
  disputed: "En disputa",
  closed: "Cerrado",
};

const MATCH_LABELS: Record<SettlementMatchStatus, string> = {
  matched: "Emparejado",
  unmatched: "Sin emparejar",
  difference: "Diferencia",
  duplicate: "Duplicado",
  disputed: "Disputado",
  resolved: "Resuelto",
};

const METHOD_LABELS: Record<SettlementMatchMethod, string> = {
  tracking: "Tracking exacto",
  external_shipment_id: "ID envío externo",
  external_order_id: "ID pedido externo",
  order_number: "Número de pedido",
  amount_time_suggestion: "Sugerencia monto+fecha",
  manual: "Manual",
};

export function labelBatchStatus(status: string): string {
  return BATCH_LABELS[status as ReconciliationStatus] ?? status;
}

export function labelMatchStatus(status: string): string {
  return MATCH_LABELS[status as SettlementMatchStatus] ?? status;
}

export function labelMatchMethod(method: string | null | undefined): string {
  if (!method) return "—";
  return METHOD_LABELS[method as SettlementMatchMethod] ?? method;
}

export const BATCH_STATUS_OPTIONS = (Object.keys(BATCH_LABELS) as ReconciliationStatus[]).map(
  (value) => ({ value, label: BATCH_LABELS[value] }),
);

export const MATCH_STATUS_OPTIONS = (Object.keys(MATCH_LABELS) as SettlementMatchStatus[]).map(
  (value) => ({ value, label: MATCH_LABELS[value] }),
);
