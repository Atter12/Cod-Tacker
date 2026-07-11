import type { Enums } from "@/types/database.generated";

export type ShipmentStatus = Enums<"shipment_status">;

const SHIPMENT_STATUS_LABELS: Record<ShipmentStatus, string> = {
  created: "Creado",
  label_generated: "Etiqueta generada",
  picked_up: "Recogido",
  in_transit: "En tránsito",
  out_for_delivery: "En reparto",
  delivered: "Entregado",
  delivery_failed: "Entrega fallida",
  rejected: "Rechazado",
  return_in_transit: "Devolución en tránsito",
  returned: "Devuelto",
  lost: "Extraviado",
  cancelled: "Cancelado",
  unknown: "Desconocido",
};

export function labelShipmentStatus(status: string): string {
  return SHIPMENT_STATUS_LABELS[status as ShipmentStatus] ?? status;
}

export const SHIPMENT_STATUS_OPTIONS = (Object.keys(SHIPMENT_STATUS_LABELS) as ShipmentStatus[]).map(
  (value) => ({ value, label: SHIPMENT_STATUS_LABELS[value] }),
);

const JOB_STATUS_LABELS: Record<string, string> = {
  queued: "En cola",
  processing: "Procesando",
  completed: "Completado",
  retry_scheduled: "Reintento programado",
  failed: "Fallido",
  dead_letter: "Cola de errores",
  cancelled: "Cancelado",
};

export function labelJobStatus(status: string): string {
  return JOB_STATUS_LABELS[status] ?? status;
}

const EVENT_STATUS_LABELS: Record<string, string> = {
  received: "Recibido",
  validated: "Validado",
  processing: "Procesando",
  processed: "Procesado",
  ignored: "Ignorado",
  retrying: "Reintentando",
  failed: "Fallido",
  dead_letter: "Cola de errores",
};

export function labelEventStatus(status: string): string {
  return EVENT_STATUS_LABELS[status] ?? status;
}

export const JOB_STATUS_VALUES = [
  "queued",
  "processing",
  "completed",
  "retry_scheduled",
  "failed",
  "dead_letter",
  "cancelled",
] as const;

export const EVENT_STATUS_VALUES = [
  "received",
  "validated",
  "processing",
  "processed",
  "ignored",
  "retrying",
  "failed",
  "dead_letter",
] as const;
