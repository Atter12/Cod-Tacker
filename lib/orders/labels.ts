import type { ConfirmationStatus, OrderStatus, PaymentStatus } from "@/types/orders";

const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  created: "Creado",
  pending_confirmation: "Pendiente de confirmación",
  confirmed: "Confirmado",
  cancelled: "Cancelado",
  ready_to_ship: "Listo para envío",
  shipped: "Enviado",
  in_transit: "En tránsito",
  out_for_delivery: "En reparto",
  delivered: "Entregado",
  delivery_failed: "Entrega fallida",
  rejected: "Rechazado",
  return_in_transit: "Devolución en tránsito",
  returned: "Devuelto",
  lost: "Extraviado",
  closed: "Cerrado",
};

const PAYMENT_STATUS_LABELS: Record<PaymentStatus, string> = {
  unpaid: "Sin pago",
  cash_expected: "COD esperado",
  cash_collected: "Cobrado",
  partially_collected: "Cobro parcial",
  settlement_pending: "Liquidación pendiente",
  settled: "Conciliado",
  disputed: "En disputa",
  refunded: "Reembolsado",
  written_off: "Castigado",
};

const CONFIRMATION_STATUS_LABELS: Record<ConfirmationStatus, string> = {
  not_requested: "No solicitada",
  pending: "Pendiente",
  confirmed: "Confirmada",
  rejected: "Rechazada",
  expired: "Expirada",
  manual_review: "Revisión manual",
};

export function labelOrderStatus(status: OrderStatus | string): string {
  return ORDER_STATUS_LABELS[status as OrderStatus] ?? status;
}

export function labelPaymentStatus(status: PaymentStatus | string): string {
  return PAYMENT_STATUS_LABELS[status as PaymentStatus] ?? status;
}

export function labelConfirmationStatus(status: ConfirmationStatus | string): string {
  return CONFIRMATION_STATUS_LABELS[status as ConfirmationStatus] ?? status;
}

export const ORDER_STATUS_OPTIONS = (Object.keys(ORDER_STATUS_LABELS) as OrderStatus[]).map((value) => ({
  value,
  label: ORDER_STATUS_LABELS[value],
}));

export const PAYMENT_STATUS_OPTIONS = (Object.keys(PAYMENT_STATUS_LABELS) as PaymentStatus[]).map((value) => ({
  value,
  label: PAYMENT_STATUS_LABELS[value],
}));

export const CONFIRMATION_STATUS_OPTIONS = (Object.keys(CONFIRMATION_STATUS_LABELS) as ConfirmationStatus[]).map(
  (value) => ({
    value,
    label: CONFIRMATION_STATUS_LABELS[value],
  }),
);
