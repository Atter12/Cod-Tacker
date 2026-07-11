import type { Json } from "@/types/database.generated";
import type { Enums } from "@/types/database.generated";

export type ShipmentStatus = Enums<"shipment_status">;

export type CarrierMappingRule = {
  external_status_code: string;
  external_status_label?: string | null;
  normalized_status: ShipmentStatus;
  is_rto: boolean;
  is_terminal: boolean;
  priority?: number;
  is_active?: boolean;
};

export type NormalizeResult =
  | {
      mapped: true;
      externalStatusCode: string;
      normalizedStatus: ShipmentStatus;
      isRto: boolean;
      isTerminal: boolean;
      mapping?: CarrierMappingRule;
    }
  | {
      mapped: false;
      externalStatusCode: string;
      normalizedStatus: "unknown";
      isRto: false;
      isTerminal: false;
    };

export const TERMINAL_STATUSES: readonly ShipmentStatus[] = [
  "delivered",
  "returned",
  "lost",
  "cancelled",
] as const;

export function isTerminalStatus(status: ShipmentStatus): boolean {
  return (TERMINAL_STATUSES as readonly string[]).includes(status);
}

/** Apply active mappings; unknown codes normalize to `unknown` (never delivered). */
export function applyMapping(
  externalStatusCode: string,
  mappings: CarrierMappingRule[],
): NormalizeResult {
  const code = externalStatusCode.trim().toLowerCase();
  const active = mappings
    .filter((m) => m.is_active !== false)
    .slice()
    .sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));

  const hit = active.find((m) => m.external_status_code.trim().toLowerCase() === code);
  if (!hit) {
    return {
      mapped: false,
      externalStatusCode: externalStatusCode.trim(),
      normalizedStatus: "unknown",
      isRto: false,
      isTerminal: false,
    };
  }

  return {
    mapped: true,
    externalStatusCode: hit.external_status_code,
    normalizedStatus: hit.normalized_status,
    isRto: hit.is_rto || hit.normalized_status === "returned" || hit.normalized_status === "return_in_transit",
    isTerminal: hit.is_terminal || isTerminalStatus(hit.normalized_status),
    mapping: hit,
  };
}

/**
 * Protect terminal shipments from older out-of-order events.
 * Returns true when the incoming event must NOT overwrite the shipment status.
 */
export function shouldProtectTerminal(input: {
  currentStatus: ShipmentStatus;
  currentIsTerminal: boolean;
  currentLastEventAt: string | null;
  incomingStatus: ShipmentStatus;
  incomingOccurredAt: string;
}): boolean {
  const currentTerminal = input.currentIsTerminal || isTerminalStatus(input.currentStatus);
  if (!currentTerminal) return false;
  if (input.incomingStatus === input.currentStatus) return false;

  const last = input.currentLastEventAt ? Date.parse(input.currentLastEventAt) : NaN;
  const incoming = Date.parse(input.incomingOccurredAt);
  if (!Number.isFinite(incoming)) return true;
  if (!Number.isFinite(last)) return true;
  return incoming < last;
}

export type ShipmentEventApplyInput = {
  shipment: {
    id: string;
    status: ShipmentStatus;
    is_terminal: boolean;
    is_rto: boolean;
    delivery_attempts: number;
    last_event_at: string | null;
    metadata: Json;
    order_id: string;
    store_id: string;
    agency_id: string;
    carrier_id: string;
  };
  externalStatusCode: string;
  externalStatusLabel?: string | null;
  externalEventId?: string | null;
  occurredAt: string;
  receivedAt?: string;
  rawEventId?: string | null;
  payload?: Json;
  mappings: CarrierMappingRule[];
};

export type ShipmentEventApplyPlan = {
  normalize: NormalizeResult;
  unmapped: boolean;
  skipStatusUpdate: boolean;
  conflict: boolean;
  nextShipment: {
    status: ShipmentStatus;
    is_terminal: boolean;
    is_rto: boolean;
    delivery_attempts: number;
    last_event_at: string;
    delivered_at?: string | null;
    returned_at?: string | null;
    first_attempt_at?: string | null;
    metadata: Json;
  };
  orderPatch: {
    order_status?: Enums<"order_status">;
    delivered_at?: string | null;
    returned_at?: string | null;
    /** Explicitly never set payment_status / settled fields on deliver. */
    payment_status?: never;
  } | null;
  eventInsert: {
    normalized_status: ShipmentStatus;
    external_status_code: string;
    external_status_label: string | null;
    occurred_at: string;
    received_at: string;
    external_event_id: string | null;
    raw_event_id: string | null;
    payload: Json;
  };
};

function asMetaObject(metadata: Json): Record<string, unknown> {
  if (metadata && typeof metadata === "object" && !Array.isArray(metadata)) {
    return { ...(metadata as Record<string, unknown>) };
  }
  return {};
}

/**
 * Pure planner for idempotent shipment event application.
 * Callers persist event + shipment + optional order patch.
 */
export function planShipmentEventApply(input: ShipmentEventApplyInput): ShipmentEventApplyPlan {
  const normalize = applyMapping(input.externalStatusCode, input.mappings);
  const receivedAt = input.receivedAt ?? new Date().toISOString();
  const protect = shouldProtectTerminal({
    currentStatus: input.shipment.status,
    currentIsTerminal: input.shipment.is_terminal,
    currentLastEventAt: input.shipment.last_event_at,
    incomingStatus: normalize.normalizedStatus,
    incomingOccurredAt: input.occurredAt,
  });

  const meta = asMetaObject(input.shipment.metadata);
  let conflict = false;
  if (protect) {
    conflict = true;
    const conflicts = Array.isArray(meta.status_conflicts) ? [...(meta.status_conflicts as unknown[])] : [];
    conflicts.push({
      at: receivedAt,
      incoming_status: normalize.normalizedStatus,
      incoming_occurred_at: input.occurredAt,
      kept_status: input.shipment.status,
      reason: "out_of_order_terminal",
    });
    meta.status_conflicts = conflicts.slice(-20);
  }

  const skipStatusUpdate = protect;
  let deliveryAttempts = input.shipment.delivery_attempts;
  if (!skipStatusUpdate && normalize.normalizedStatus === "delivery_failed") {
    deliveryAttempts += 1;
  }

  const nextStatus = skipStatusUpdate ? input.shipment.status : normalize.normalizedStatus;
  const nextIsTerminal = skipStatusUpdate
    ? input.shipment.is_terminal || isTerminalStatus(input.shipment.status)
    : normalize.isTerminal || isTerminalStatus(normalize.normalizedStatus);
  const nextIsRto = skipStatusUpdate
    ? input.shipment.is_rto
    : normalize.isRto ||
      normalize.normalizedStatus === "returned" ||
      normalize.normalizedStatus === "return_in_transit";

  const nextShipment: ShipmentEventApplyPlan["nextShipment"] = {
    status: nextStatus,
    is_terminal: nextIsTerminal,
    is_rto: nextIsRto,
    delivery_attempts: deliveryAttempts,
    last_event_at: skipStatusUpdate
      ? (input.shipment.last_event_at ?? input.occurredAt)
      : input.occurredAt,
    metadata: meta as Json,
  };

  if (!skipStatusUpdate && normalize.normalizedStatus === "delivered") {
    nextShipment.delivered_at = input.occurredAt;
  }
  if (!skipStatusUpdate && normalize.normalizedStatus === "returned") {
    nextShipment.returned_at = input.occurredAt;
    nextShipment.is_rto = true;
  }
  if (!skipStatusUpdate && normalize.normalizedStatus === "delivery_failed" && deliveryAttempts === 1) {
    nextShipment.first_attempt_at = input.occurredAt;
  }

  let orderPatch: ShipmentEventApplyPlan["orderPatch"] = null;
  if (!skipStatusUpdate && normalize.normalizedStatus === "delivered") {
    orderPatch = {
      order_status: "delivered",
      delivered_at: input.occurredAt,
    };
  } else if (!skipStatusUpdate && normalize.normalizedStatus === "returned") {
    orderPatch = {
      order_status: "returned",
      returned_at: input.occurredAt,
    };
  }

  return {
    normalize,
    unmapped: !normalize.mapped,
    skipStatusUpdate,
    conflict,
    nextShipment,
    orderPatch,
    eventInsert: {
      normalized_status: normalize.normalizedStatus,
      external_status_code: input.externalStatusCode,
      external_status_label: input.externalStatusLabel ?? null,
      occurred_at: input.occurredAt,
      received_at: receivedAt,
      external_event_id: input.externalEventId ?? null,
      raw_event_id: input.rawEventId ?? null,
      payload: input.payload ?? {},
    },
  };
}
