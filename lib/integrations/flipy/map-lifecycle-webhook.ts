import { readFlipyFleteQuote, type FlipyFleteQuote } from "@/lib/integrations/flipy/partner-contract";
import {
  mapFlipyWebhookToJobPayload,
  normalizeFlipyOrderExternalId,
  type FlipyCarrierJobPayload,
} from "@/lib/integrations/flipy/map-webhook";
import { resolveFlipyExternalStatusCode } from "@/lib/integrations/flipy/map-status";

/** v0.2 lifecycle events — see docs/FLIPY_CODTRACKED_ALIGNMENT_V0.2.md §3.6 */
export const FLIPY_LIFECYCLE_EVENT_TYPES = [
  "shipment.created",
  "shipment.assigned",
  "shipment.smart_fallback_to_bid",
] as const;

export type FlipyLifecycleEventType = (typeof FLIPY_LIFECYCLE_EVENT_TYPES)[number];

export type FlipyAssignedMotorizadoPayload = {
  id: string;
  displayName?: string | null;
  etaMinutes?: number | null;
};

export type FlipyLifecycleJobPayload = {
  event_type: FlipyLifecycleEventType;
  envio_id: string;
  external_order_id: string | null;
  estado: string | null;
  tracking_token: string | null;
  tracking_url: string | null;
  fulfillment_mode: "smart" | "bid" | null;
  escenario_pago: string | null;
  assigned_motorizado: FlipyAssignedMotorizadoPayload | null;
  flete_quote: FlipyFleteQuote | null;
  payment_breakdown: Record<string, unknown> | null;
  occurred_at: string;
  external_event_id: string;
  carrier_payload: FlipyCarrierJobPayload | null;
};

function asRecord(raw: unknown): Record<string, unknown> | null {
  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    return raw as Record<string, unknown>;
  }
  return null;
}

function readString(bag: Record<string, unknown>, ...keys: string[]): string | null {
  for (const key of keys) {
    const v = bag[key];
    if (typeof v === "string" && v.trim()) return v.trim();
    if (typeof v === "number" && Number.isFinite(v)) return String(v);
  }
  return null;
}

/** Read Partner webhook `type` / `event` field. */
export function readFlipyWebhookEventType(raw: unknown): string | null {
  const root = asRecord(raw);
  if (!root) return null;
  const type =
    readString(root, "type", "event", "event_type", "eventType") ??
    readString(asRecord(root.data) ?? {}, "type", "event");
  return type ? type.toLowerCase() : null;
}

export function isFlipyLifecycleWebhookEvent(type: string | null): type is FlipyLifecycleEventType {
  if (!type) return false;
  return (FLIPY_LIFECYCLE_EVENT_TYPES as readonly string[]).includes(type);
}

function readAssignedMotorizado(data: Record<string, unknown>): FlipyAssignedMotorizadoPayload | null {
  const bag =
    asRecord(data.assignedMotorizado) ??
    asRecord(data.assigned_motorizado) ??
    asRecord(data.motorizado);
  if (!bag) return null;
  const id = readString(bag, "id", "motorizadoId", "motorizado_id");
  if (!id) return null;
  const eta = bag.etaMinutes ?? bag.eta_minutes ?? bag.eta;
  return {
    id,
    displayName: readString(bag, "displayName", "display_name", "nombre"),
    etaMinutes: typeof eta === "number" && Number.isFinite(eta) ? eta : null,
  };
}

function normalizeDate(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return new Date().toISOString();
  const parsed = Date.parse(trimmed);
  if (!Number.isNaN(parsed)) return new Date(parsed).toISOString();
  return new Date().toISOString();
}

/**
 * Map v0.2 lifecycle webhook → `flipy.shipment.lifecycle` job payload.
 * Also builds optional carrier sync payload when tracking + estado are present.
 */
export function mapFlipyLifecycleWebhookToJobPayload(
  raw: unknown,
  headers?: { eventId?: string | null },
):
  | { ok: true; payload: FlipyLifecycleJobPayload }
  | { ok: false; error: string } {
  const root = asRecord(raw);
  if (!root) return { ok: false, error: "payload_not_object" };

  const eventType = readFlipyWebhookEventType(raw);
  if (!isFlipyLifecycleWebhookEvent(eventType)) {
    return { ok: false, error: "not_lifecycle_event" };
  }

  const data = asRecord(root.data) ?? root;
  const envioId = readString(data, "envioId", "envio_id", "id");
  if (!envioId) return { ok: false, error: "missing_envio_id" };

  const orderExternalRaw =
    readString(data, "externalOrderId", "external_order_id", "order_external_id") ??
    readString(root, "externalOrderId", "external_order_id");
  const externalOrderId = normalizeFlipyOrderExternalId(orderExternalRaw);

  const trackingToken =
    readString(data, "trackingToken", "tracking_token", "tracking_number") ??
    readString(root, "trackingToken", "tracking_token");
  const trackingUrl = readString(data, "trackingUrl", "tracking_url");
  const estadoRaw =
    readString(data, "estado", "status", "external_status_code") ??
    readString(root, "estado", "status");
  const estado = estadoRaw ? resolveFlipyExternalStatusCode(estadoRaw) : null;

  const fulfillmentRaw = readString(data, "fulfillmentMode", "fulfillment_mode");
  const fulfillmentMode =
    fulfillmentRaw === "smart" || fulfillmentRaw === "bid" ? fulfillmentRaw : null;

  const escenarioPago = readString(data, "escenarioPago", "escenario_pago");
  const fleteQuote = readFlipyFleteQuote(data) ?? readFlipyFleteQuote(root);
  const paymentBreakdown =
    asRecord(data.paymentBreakdown) ?? asRecord(data.payment_breakdown) ?? null;

  const occurredAt =
    readString(root, "occurred_at", "occurredAt", "created_at", "updated_at") ??
    readString(data, "occurred_at", "occurredAt", "created_at", "updated_at") ??
    new Date().toISOString();

  const eventIdHeader = headers?.eventId?.trim() || null;
  const externalEventId =
    eventIdHeader ||
    readString(root, "eventId", "event_id", "id") ||
    `flipy:${eventType}:${envioId}:${occurredAt}`.slice(0, 200);

  let carrierPayload: FlipyCarrierJobPayload | null = null;
  if (trackingToken && estado) {
    const carrierMapped = mapFlipyWebhookToJobPayload(
      {
        type: "shipment.status.updated",
        data: {
          envioId,
          externalOrderId: orderExternalRaw,
          estado,
          trackingToken,
          trackingUrl,
          escenarioPago,
        },
      },
      { eventId: `${externalEventId}:carrier` },
    );
    if (carrierMapped.ok) carrierPayload = carrierMapped.payload;
  }

  return {
    ok: true,
    payload: {
      event_type: eventType,
      envio_id: envioId,
      external_order_id: externalOrderId,
      estado,
      tracking_token: trackingToken,
      tracking_url: trackingUrl,
      fulfillment_mode: fulfillmentMode,
      escenario_pago: escenarioPago,
      assigned_motorizado: readAssignedMotorizado(data),
      flete_quote: fleteQuote,
      payment_breakdown: paymentBreakdown,
      occurred_at: normalizeDate(occurredAt),
      external_event_id: externalEventId,
      carrier_payload: carrierPayload,
    },
  };
}
