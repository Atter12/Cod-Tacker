import type { ShipmentStatus } from "@/lib/logistics/normalize";
import type { CarrierMappingRule } from "@/lib/logistics/normalize";

/**
 * Enviame status_id → status_code (docs.enviame.io/docs/webhooks).
 * Used when webhook only sends status_id + status_name.
 */
export const ENVIAME_STATUS_ID_TO_CODE: Readonly<Record<number, string>> = {
  1: "PENDING",
  2: "PENDING",
  3: "PENDING",
  4: "PENDING",
  5: "CREATED",
  6: "IN_ORIGIN",
  7: "IN_TRANSIT",
  8: "IN_DESTINATION",
  9: "DISPATCHED",
  10: "DELIVERED_DOM",
  11: "DELIVERED_PUDO",
  12: "DELETED",
  13: "PICKED_UP",
  14: "RETURNED",
  16: "PICK_UP_CARRIER",
  17: "ADDRESS_NOT_FOUND",
  18: "REJECTED_CLIENT",
  19: "NO_ONE_HOME",
  20: "DAMAGED_SHIPMENT",
  22: "LOST_SHIPMENT",
  23: "AWAITING",
  24: "LOST",
  27: "NOT_DELIVERED",
  29: "EXPIRED",
  30: "RETURN_DELIVERED",
  33: "RETURN_DISPATCHED",
  41: "DELIVERY_FAILED",
  44: "RETURNED_TO_SHIPPER",
  49: "CANCELED",
  55: "RETURN_START",
  97: "DELIVERY_FAILED",
};

/** Fallback mappings when `carrier_status_mappings` for code=enviame is empty. */
export const ENVIAME_DEFAULT_MAPPINGS: readonly CarrierMappingRule[] = [
  { external_status_code: "PENDING", normalized_status: "created", is_rto: false, is_terminal: false, priority: 0 },
  { external_status_code: "AWAITING", normalized_status: "created", is_rto: false, is_terminal: false, priority: 0 },
  { external_status_code: "CREATED", normalized_status: "label_generated", is_rto: false, is_terminal: false, priority: 0 },
  { external_status_code: "PICK_UP_CARRIER", normalized_status: "picked_up", is_rto: false, is_terminal: false, priority: 0 },
  { external_status_code: "IN_ORIGIN", normalized_status: "picked_up", is_rto: false, is_terminal: false, priority: 0 },
  { external_status_code: "IN_TRANSIT", normalized_status: "in_transit", is_rto: false, is_terminal: false, priority: 0 },
  { external_status_code: "IN_DESTINATION", normalized_status: "in_transit", is_rto: false, is_terminal: false, priority: 0 },
  { external_status_code: "DISPATCHED", normalized_status: "out_for_delivery", is_rto: false, is_terminal: false, priority: 0 },
  { external_status_code: "DELIVERED_DOM", normalized_status: "delivered", is_rto: false, is_terminal: true, priority: 10 },
  { external_status_code: "DELIVERED_PUDO", normalized_status: "delivered", is_rto: false, is_terminal: true, priority: 10 },
  { external_status_code: "PICKED_UP", normalized_status: "delivered", is_rto: false, is_terminal: true, priority: 10 },
  { external_status_code: "NOT_DELIVERED", normalized_status: "delivery_failed", is_rto: false, is_terminal: false, priority: 0 },
  { external_status_code: "DELIVERY_FAILED", normalized_status: "delivery_failed", is_rto: false, is_terminal: false, priority: 0 },
  { external_status_code: "NO_ONE_HOME", normalized_status: "delivery_failed", is_rto: false, is_terminal: false, priority: 0 },
  { external_status_code: "ADDRESS_NOT_FOUND", normalized_status: "delivery_failed", is_rto: false, is_terminal: false, priority: 0 },
  { external_status_code: "REJECTED_CLIENT", normalized_status: "rejected", is_rto: false, is_terminal: false, priority: 0 },
  { external_status_code: "RETURN_START", normalized_status: "return_in_transit", is_rto: true, is_terminal: false, priority: 0 },
  { external_status_code: "RETURN_DISPATCHED", normalized_status: "return_in_transit", is_rto: true, is_terminal: false, priority: 0 },
  { external_status_code: "RETURNED", normalized_status: "returned", is_rto: true, is_terminal: true, priority: 10 },
  { external_status_code: "RETURN_DELIVERED", normalized_status: "returned", is_rto: true, is_terminal: true, priority: 10 },
  { external_status_code: "RETURNED_TO_SHIPPER", normalized_status: "returned", is_rto: true, is_terminal: true, priority: 10 },
  { external_status_code: "LOST", normalized_status: "lost", is_rto: false, is_terminal: true, priority: 10 },
  { external_status_code: "LOST_SHIPMENT", normalized_status: "lost", is_rto: false, is_terminal: true, priority: 10 },
  { external_status_code: "CANCELED", normalized_status: "cancelled", is_rto: false, is_terminal: true, priority: 10 },
  { external_status_code: "DELETED", normalized_status: "cancelled", is_rto: false, is_terminal: true, priority: 10 },
  { external_status_code: "EXPIRED", normalized_status: "cancelled", is_rto: false, is_terminal: true, priority: 0 },
];

export function resolveEnviameExternalStatusCode(input: {
  statusId?: number | null;
  statusCode?: string | null;
  statusName?: string | null;
}): string {
  const fromCode = input.statusCode?.trim();
  if (fromCode) return fromCode.toUpperCase().replace(/\s+/g, "_");

  if (input.statusId != null && Number.isFinite(input.statusId)) {
    const mapped = ENVIAME_STATUS_ID_TO_CODE[input.statusId];
    if (mapped) return mapped;
    return `STATUS_ID_${input.statusId}`;
  }

  const name = input.statusName?.trim();
  if (name) return name.toUpperCase().replace(/\s+/g, "_");
  return "UNKNOWN";
}

/** Hint for tests / docs — not used as sole source of truth when DB mappings exist. */
export function defaultNormalizedForEnviameCode(code: string): ShipmentStatus | "unknown" {
  const hit = ENVIAME_DEFAULT_MAPPINGS.find(
    (m) => m.external_status_code.toLowerCase() === code.trim().toLowerCase(),
  );
  return hit?.normalized_status ?? "unknown";
}
