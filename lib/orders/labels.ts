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

/** Carrier / shipment status codes that may arrive in English. */
const SHIPMENT_STATUS_LABELS: Record<string, string> = {
  created: "Creado",
  labeled: "Etiquetado",
  picked_up: "Recogido",
  in_transit: "En tránsito",
  out_for_delivery: "En reparto",
  delivered: "Entregado",
  delivery_failed: "Entrega fallida",
  returned: "Devuelto",
  return_in_transit: "Devolución en tránsito",
  cancelled: "Cancelado",
  lost: "Extraviado",
  unknown: "Desconocido",
};

const ATTRIBUTION_MODEL_LABELS: Record<string, string> = {
  utm_last_touch: "Último toque (UTM)",
  last_touch: "Último toque",
  first_touch: "Primer toque",
  linear: "Lineal",
  position_based: "Basado en posición",
  time_decay: "Decaimiento temporal",
};

const PLATFORM_LABELS: Record<string, string> = {
  meta: "Meta",
  facebook: "Meta",
  fb: "Meta",
  tiktok: "TikTok",
  tt: "TikTok",
  google: "Google",
  organic: "Orgánico",
  direct: "Directo",
  other: "Otro",
};

const AUDIT_ACTION_LABELS: Record<string, string> = {
  order_confirmed: "Pedido confirmado",
  order_cancelled: "Pedido cancelado",
  order_rejected: "Pedido rechazado",
  order_status_changed: "Estado del pedido actualizado",
  order_payment_status_changed: "Estado de pago actualizado",
  order_marked_for_review: "Marcado para revisión",
  order_note_added: "Nota interna agregada",
  order_alert_created: "Alerta creada",
  conversion_released: "Conversión liberada",
  conversion_rejected: "Conversión rechazada",
  shipment_alert_created: "Alerta de envío creada",
  shipment_marked_for_review: "Envío marcado para revisión",
};

const TIMELINE_KIND_LABELS: Record<string, string> = {
  status: "Estado",
  shipment: "Envío",
  payment: "Pago",
  confirmation: "Confirmación",
  attribution: "Atribución",
  conversion: "Conversión",
  whatsapp: "WhatsApp",
  settlement: "Conciliación",
  audit: "Auditoría",
  note: "Nota",
  alert: "Alerta",
  raw_event: "Técnico",
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

export function labelShipmentStatus(status: string | null | undefined): string {
  if (!status?.trim()) return "Sin estado";
  const key = status.trim().toLowerCase().replace(/\s+/g, "_");
  return SHIPMENT_STATUS_LABELS[key] ?? labelOrderStatus(key);
}

export function labelAttributionModel(model: string | null | undefined): string {
  if (!model?.trim()) return "—";
  const key = model.trim().toLowerCase();
  return ATTRIBUTION_MODEL_LABELS[key] ?? model;
}

export function labelPlatform(platform: string | null | undefined): string {
  if (!platform?.trim()) return "—";
  const key = platform.trim().toLowerCase();
  return PLATFORM_LABELS[key] ?? platform;
}

export function labelAuditAction(action: string | null | undefined): string {
  if (!action?.trim()) return "Acción registrada";
  return AUDIT_ACTION_LABELS[action] ?? action.replace(/_/g, " ");
}

export function labelTimelineKind(kind: string | null | undefined): string {
  if (!kind?.trim()) return "";
  return TIMELINE_KIND_LABELS[kind] ?? kind;
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
