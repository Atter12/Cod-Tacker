import type { CarrierMappingRule } from "@/lib/logistics/normalize";

/**
 * Flipy Envio.estado → COD-tracked shipment_status.
 * Validated in F0-2 — see docs/FLIPY_INTEGRATION_GATES.md.
 */
export const FLIPY_DEFAULT_MAPPINGS: readonly CarrierMappingRule[] = [
  {
    external_status_code: "BORRADOR",
    external_status_label: "Borrador",
    normalized_status: "created",
    is_rto: false,
    is_terminal: false,
    priority: 0,
  },
  {
    external_status_code: "PENDIENTE_PUJAS",
    external_status_label: "Pendiente de pujas",
    normalized_status: "created",
    is_rto: false,
    is_terminal: false,
    priority: 0,
  },
  {
    external_status_code: "ASIGNANDO_SMART",
    external_status_label: "Asignando motorizado",
    normalized_status: "created",
    is_rto: false,
    is_terminal: false,
    priority: 0,
  },
  {
    external_status_code: "ASIGNADO",
    external_status_label: "Asignado",
    normalized_status: "label_generated",
    is_rto: false,
    is_terminal: false,
    priority: 0,
  },
  {
    external_status_code: "EN_CURSO",
    external_status_label: "En curso",
    normalized_status: "in_transit",
    is_rto: false,
    is_terminal: false,
    priority: 0,
  },
  {
    external_status_code: "ENTREGADO",
    external_status_label: "Entregado",
    normalized_status: "delivered",
    is_rto: false,
    is_terminal: true,
    priority: 10,
  },
  {
    external_status_code: "CANCELADO",
    external_status_label: "Cancelado",
    normalized_status: "cancelled",
    is_rto: false,
    is_terminal: true,
    priority: 10,
  },
];

export function resolveFlipyExternalStatusCode(rawStatus: string | null | undefined): string {
  const s = (rawStatus ?? "").trim();
  if (!s) return "UNKNOWN";
  if (/^[A-Z0-9_]+$/.test(s)) return s;
  return s.toUpperCase().replace(/\s+/g, "_").slice(0, 80);
}
