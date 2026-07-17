import type { CarrierMappingRule } from "@/lib/logistics/normalize";

/**
 * Map free-text / Envia status strings → external codes used by ENVIA_DEFAULT_MAPPINGS.
 * Handles dashboard type `onShipmentStatusUpdate` and Queries API `tracking.simple`.
 */
export function resolveEnviaExternalStatusCode(rawStatus: string | null | undefined): string {
  const s = (rawStatus ?? "").trim();
  if (!s) return "UNKNOWN";

  const lower = s.toLowerCase().replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim();

  if (
    lower === "delivered" ||
    lower.includes("entregado") ||
    lower.includes("delivered") ||
    lower === "delivery confirmed"
  ) {
    return "DELIVERED";
  }
  if (
    lower.includes("return") ||
    lower.includes("rto") ||
    lower.includes("devoluc") ||
    lower.includes("returned to sender")
  ) {
    return "RETURNED";
  }
  if (lower.includes("out for delivery") || lower.includes("en reparto") || lower.includes("dispatched")) {
    return "OUT_FOR_DELIVERY";
  }
  if (
    lower.includes("in transit") ||
    lower.includes("en transito") ||
    lower.includes("en tránsito") ||
    lower.includes("transit")
  ) {
    return "IN_TRANSIT";
  }
  if (lower.includes("picked up") || lower.includes("recolect") || lower.includes("pickup")) {
    return "PICKED_UP";
  }
  if (lower.includes("label") || lower.includes("created") || lower.includes("creado") || lower === "pending") {
    return "CREATED";
  }
  if (
    lower.includes("fail") ||
    lower.includes("exception") ||
    lower.includes("undeliver") ||
    lower.includes("no entreg")
  ) {
    return "DELIVERY_FAILED";
  }
  if (lower.includes("cancel") || lower.includes("anulad")) {
    return "CANCELLED";
  }
  if (lower.includes("lost") || lower.includes("extraviad")) {
    return "LOST";
  }

  // Pass through UPPER_SNAKE if already code-like
  if (/^[A-Z0-9_]+$/.test(s)) return s;
  return s.toUpperCase().replace(/\s+/g, "_").slice(0, 80);
}

/** Fallback mappings when carrier_status_mappings for envia_com is empty. */
export const ENVIA_DEFAULT_MAPPINGS: readonly CarrierMappingRule[] = [
  { external_status_code: "CREATED", normalized_status: "label_generated", is_rto: false, is_terminal: false, priority: 0 },
  { external_status_code: "PICKED_UP", normalized_status: "picked_up", is_rto: false, is_terminal: false, priority: 0 },
  { external_status_code: "IN_TRANSIT", normalized_status: "in_transit", is_rto: false, is_terminal: false, priority: 0 },
  {
    external_status_code: "OUT_FOR_DELIVERY",
    normalized_status: "out_for_delivery",
    is_rto: false,
    is_terminal: false,
    priority: 0,
  },
  { external_status_code: "DELIVERED", normalized_status: "delivered", is_rto: false, is_terminal: true, priority: 10 },
  {
    external_status_code: "DELIVERY_FAILED",
    normalized_status: "delivery_failed",
    is_rto: false,
    is_terminal: false,
    priority: 0,
  },
  { external_status_code: "RETURNED", normalized_status: "returned", is_rto: true, is_terminal: true, priority: 10 },
  { external_status_code: "LOST", normalized_status: "lost", is_rto: false, is_terminal: true, priority: 10 },
  { external_status_code: "CANCELLED", normalized_status: "cancelled", is_rto: false, is_terminal: true, priority: 10 },
  { external_status_code: "UNKNOWN", normalized_status: "unknown", is_rto: false, is_terminal: false, priority: 0 },
];
