import { resolveEnviameExternalStatusCode } from "@/lib/integrations/enviame/map-status";

/** Raw webhook body from Enviame (docs.enviame.io/docs/webhooks). */
export type EnviameWebhookPayload = {
  status_id?: number;
  identifier?: number | string;
  summary_id?: number;
  status_date?: string;
  status_name?: string;
  /** Some payloads may include code; webhook table lists status_id/name primarily. */
  status_code?: string;
  carrier_code?: string;
  carrier_name?: string;
  imported_id?: string;
  tracking_url?: string;
  dead_line_date?: string;
  tracking_number?: string;
  status_information?: string;
};

export type CarrierShipmentUpdatedJobPayload = {
  tracking_number: string;
  external_shipment_id?: string;
  external_status_code: string;
  external_status_label?: string;
  order_external_id?: string;
  external_event_id: string;
  occurred_at?: string;
  carrier_code: "enviame";
  mode: "live";
  source: "enviame.webhook" | "enviame.tracking";
  tracking_url?: string;
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

function readNumber(bag: Record<string, unknown>, ...keys: string[]): number | null {
  for (const key of keys) {
    const v = bag[key];
    if (typeof v === "number" && Number.isFinite(v)) return v;
    if (typeof v === "string" && v.trim() && !Number.isNaN(Number(v))) return Number(v);
  }
  return null;
}

export function parseEnviameWebhookPayload(raw: unknown): EnviameWebhookPayload | null {
  const bag = asRecord(raw);
  if (!bag) return null;
  return {
    status_id: readNumber(bag, "status_id") ?? undefined,
    identifier: readString(bag, "identifier") ?? undefined,
    summary_id: readNumber(bag, "summary_id") ?? undefined,
    status_date: readString(bag, "status_date") ?? undefined,
    status_name: readString(bag, "status_name") ?? undefined,
    status_code: readString(bag, "status_code", "code") ?? undefined,
    carrier_code: readString(bag, "carrier_code") ?? undefined,
    carrier_name: readString(bag, "carrier_name") ?? undefined,
    imported_id: readString(bag, "imported_id") ?? undefined,
    tracking_url: readString(bag, "tracking_url") ?? undefined,
    dead_line_date: readString(bag, "dead_line_date") ?? undefined,
    tracking_number: readString(bag, "tracking_number") ?? undefined,
    status_information: readString(bag, "status_information") ?? undefined,
  };
}

/**
 * Map Enviame webhook → carrier.shipment.updated job payload.
 * Endpoint used: Enviame outbound webhook POST (status change notifications).
 */
export function mapEnviameWebhookToJobPayload(
  raw: unknown,
): { ok: true; payload: CarrierShipmentUpdatedJobPayload } | { ok: false; error: string } {
  const wh = parseEnviameWebhookPayload(raw);
  if (!wh) return { ok: false, error: "payload_not_object" };

  const tracking =
    wh.tracking_number ||
    (wh.identifier != null ? String(wh.identifier) : null) ||
    wh.imported_id;
  if (!tracking) return { ok: false, error: "missing_tracking_number" };

  const externalCode = resolveEnviameExternalStatusCode({
    statusId: wh.status_id,
    statusCode: wh.status_code,
    statusName: wh.status_name,
  });

  const occurredAt = wh.status_date
    ? normalizeEnviameDate(wh.status_date)
    : new Date().toISOString();

  const externalEventId = [
    "enviame",
    String(wh.identifier ?? tracking),
    String(wh.status_id ?? externalCode),
    occurredAt,
  ].join(":");

  return {
    ok: true,
    payload: {
      tracking_number: tracking,
      external_shipment_id: wh.identifier != null ? String(wh.identifier) : tracking,
      external_status_code: externalCode,
      external_status_label: wh.status_name ?? wh.status_information ?? externalCode,
      order_external_id: wh.imported_id || undefined,
      external_event_id: externalEventId,
      occurred_at: occurredAt,
      carrier_code: "enviame",
      mode: "live",
      source: "enviame.webhook",
      tracking_url: wh.tracking_url,
      carrier_name: wh.carrier_name,
    },
  };
}

/** Accept "2019-08-24" or full timestamps; return ISO when possible. */
export function normalizeEnviameDate(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return new Date().toISOString();
  const parsed = Date.parse(trimmed);
  if (!Number.isNaN(parsed)) return new Date(parsed).toISOString();
  // date-only YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return new Date(`${trimmed}T12:00:00.000Z`).toISOString();
  }
  return new Date().toISOString();
}
