import { resolveEnviaExternalStatusCode } from "@/lib/integrations/envia/map-status";

export type EnviaCarrierJobPayload = {
  tracking_number: string;
  external_shipment_id?: string;
  external_status_code: string;
  external_status_label?: string;
  order_external_id?: string;
  external_event_id: string;
  occurred_at?: string;
  carrier_code: "envia_com";
  mode: "live";
  source: "envia.webhook";
  carrier_name?: string;
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

/**
 * Accepts:
 * - Legacy UI `onShipmentStatusUpdate`: { carrierName, trackingNumber, status }
 * - Test / docs variants: { carrier, tracking_number, shipment_status }
 * - Queries tracking.simple: { type, created_at, data: { tracking_number, status, ... } }
 */
export function mapEnviaWebhookToJobPayload(
  raw: unknown,
  headers?: { webhookId?: string | null; event?: string | null },
): { ok: true; payload: EnviaCarrierJobPayload } | { ok: false; error: string } {
  const root = asRecord(raw);
  if (!root) return { ok: false, error: "payload_not_object" };

  const data = asRecord(root.data) ?? root;

  const tracking =
    readString(data, "tracking_number", "trackingNumber", "tracking") ||
    readString(root, "tracking_number", "trackingNumber");
  if (!tracking) return { ok: false, error: "missing_tracking_number" };

  const statusRaw =
    readString(data, "status", "shipment_status", "shipmentStatus", "status_description") ||
    readString(root, "status", "shipment_status", "shipmentStatus");
  const externalCode = resolveEnviaExternalStatusCode(statusRaw);

  const carrierName =
    readString(data, "carrier_name", "carrierName", "carrier") ||
    readString(root, "carrier_name", "carrierName", "carrier") ||
    undefined;

  const shipmentId =
    readString(data, "shipment_id", "shipmentId", "id") ||
    readString(root, "shipment_id", "shipmentId");

  const orderExternal =
    readString(data, "order_id", "orderId", "imported_id", "reference") ||
    readString(root, "order_id", "orderId") ||
    undefined;

  const occurredAt =
    readString(root, "created_at", "createdAt", "status_date") ||
    readString(data, "created_at", "occurred_at") ||
    new Date().toISOString();

  const occurredIso = normalizeDate(occurredAt);
  const webhookId = headers?.webhookId?.trim() || null;
  const externalEventId =
    webhookId ||
    ["envia", shipmentId ?? tracking, externalCode, occurredIso].join(":");

  return {
    ok: true,
    payload: {
      tracking_number: tracking,
      external_shipment_id: shipmentId ?? tracking,
      external_status_code: externalCode,
      external_status_label: statusRaw ?? externalCode,
      order_external_id: orderExternal,
      external_event_id: externalEventId.slice(0, 200),
      occurred_at: occurredIso,
      carrier_code: "envia_com",
      mode: "live",
      source: "envia.webhook",
      carrier_name: carrierName,
    },
  };
}

function normalizeDate(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return new Date().toISOString();
  const parsed = Date.parse(trimmed);
  if (!Number.isNaN(parsed)) return new Date(parsed).toISOString();
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return new Date(`${trimmed}T12:00:00.000Z`).toISOString();
  }
  return new Date().toISOString();
}
