import { resolveFlipyExternalStatusCode } from "@/lib/integrations/flipy/map-status";
import { readFlipyDevolucionInfo } from "@/lib/integrations/flipy/partner-contract";

export type FlipyCarrierJobPayload = {
  tracking_number: string;
  external_shipment_id?: string;
  external_status_code: string;
  external_status_label?: string;
  order_external_id?: string;
  external_event_id: string;
  occurred_at?: string;
  carrier_code: "flipy";
  mode: "live";
  source: "flipy.webhook";
  metadata?: Record<string, unknown>;
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

/** Normalize Shopify external order id: `shopify:7123456789` → `7123456789`. */
export function normalizeFlipyOrderExternalId(raw: string | null | undefined): string | null {
  if (!raw?.trim()) return null;
  const trimmed = raw.trim();
  const shopifyMatch = /^shopify:(\d+)$/i.exec(trimmed);
  if (shopifyMatch?.[1]) return shopifyMatch[1];
  const digits = trimmed.replace(/\D/g, "");
  return digits || trimmed;
}

/**
 * Accepts Flipy partner webhook payloads:
 * - `{ type, data: { envioId, externalOrderId, estado, trackingToken, ... } }`
 * - Flat variants with tracking_number / estado fields
 */
export function mapFlipyWebhookToJobPayload(
  raw: unknown,
  headers?: { eventId?: string | null },
): { ok: true; payload: FlipyCarrierJobPayload } | { ok: false; error: string } {
  const root = asRecord(raw);
  if (!root) return { ok: false, error: "payload_not_object" };

  const data = asRecord(root.data) ?? root;

  const tracking =
    readString(data, "trackingToken", "tracking_token", "tracking_number", "trackingNumber") ||
    readString(root, "trackingToken", "tracking_token", "tracking_number");
  if (!tracking) return { ok: false, error: "missing_tracking_number" };

  const estadoRaw =
    readString(data, "estado", "status", "external_status_code") ||
    readString(root, "estado", "status");
  const externalCode = resolveFlipyExternalStatusCode(estadoRaw);

  const envioId =
    readString(data, "envioId", "envio_id", "external_shipment_id") ||
    readString(root, "envioId", "envio_id");

  const orderExternalRaw =
    readString(data, "externalOrderId", "external_order_id", "order_external_id") ||
    readString(root, "externalOrderId", "external_order_id");
  const orderExternal = normalizeFlipyOrderExternalId(orderExternalRaw);

  const occurredAt =
    readString(root, "occurred_at", "occurredAt", "updated_at") ||
    readString(data, "occurred_at", "occurredAt", "updated_at") ||
    new Date().toISOString();

  const metadataBag = asRecord(data.metadata) ?? {};
  const trackingUrl = readString(data, "trackingUrl", "tracking_url");
  if (trackingUrl) metadataBag.tracking_url = trackingUrl;
  const escenario = readString(data, "escenarioPago", "escenario_pago");
  if (escenario) metadataBag.escenario_pago = escenario;
  const collected =
    typeof data.collected_cod_amount === "number"
      ? data.collected_cod_amount
      : typeof data.collectedCodAmount === "number"
        ? data.collectedCodAmount
        : null;
  if (collected != null) metadataBag.collected_cod_amount = collected;

  const devolucion = readFlipyDevolucionInfo(data.devolucion);
  if (devolucion) metadataBag.devolucion = devolucion;

  const eventIdHeader = headers?.eventId?.trim() || null;
  const externalEventId =
    eventIdHeader ||
    readString(root, "eventId", "event_id", "id") ||
    `flipy:${envioId ?? tracking}:${externalCode}:${occurredAt}`.slice(0, 200);

  return {
    ok: true,
    payload: {
      tracking_number: tracking,
      external_shipment_id: envioId ?? tracking,
      external_status_code: externalCode,
      external_status_label: estadoRaw ?? externalCode,
      order_external_id: orderExternal ?? undefined,
      external_event_id: externalEventId.slice(0, 200),
      occurred_at: normalizeDate(occurredAt),
      carrier_code: "flipy",
      mode: "live",
      source: "flipy.webhook",
      metadata: Object.keys(metadataBag).length ? metadataBag : undefined,
    },
  };
}

function normalizeDate(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return new Date().toISOString();
  const parsed = Date.parse(trimmed);
  if (!Number.isNaN(parsed)) return new Date(parsed).toISOString();
  return new Date().toISOString();
}
