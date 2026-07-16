import "server-only";

import { getEnviameEnv } from "@/lib/integrations/enviame/env";
import { resolveEnviameExternalStatusCode } from "@/lib/integrations/enviame/map-status";
import { normalizeEnviameDate } from "@/lib/integrations/enviame/map-webhook";
import type { CarrierTrackingSnapshot } from "@/lib/integrations/contracts/carrier-provider";
import { logger } from "@/lib/observability/logger";

/**
 * Enviame tracking API (v2):
 *   GET {base}/api/s2/v2/deliveries/{identifier}/tracking
 * Header: api-key
 * Docs: https://docs.enviame.io/docs/v2
 */

export type EnviameTrackingFetchResult =
  | { ok: true; snapshot: CarrierTrackingSnapshot; raw: unknown }
  | { ok: false; error: string; statusCode?: number; raw?: unknown };

export async function fetchEnviameDeliveryTracking(input: {
  identifier: string;
  apiKey: string;
  apiBaseUrl?: string;
}): Promise<EnviameTrackingFetchResult> {
  const base = (input.apiBaseUrl ?? getEnviameEnv().apiBaseUrl).replace(/\/$/, "");
  const url = `${base}/api/s2/v2/deliveries/${encodeURIComponent(input.identifier)}/tracking`;

  try {
    const res = await fetch(url, {
      method: "GET",
      headers: {
        "api-key": input.apiKey,
        Accept: "application/json",
        "Content-Type": "application/json",
      },
    });
    const text = await res.text();
    let parsed: unknown = text;
    try {
      parsed = JSON.parse(text) as unknown;
    } catch {
      /* keep text */
    }
    if (!res.ok) {
      logger.warn("enviame.tracking.failed", {
        identifier: input.identifier,
        status: res.status,
        endpoint: "GET /api/s2/v2/deliveries/{identifier}/tracking",
      });
      return {
        ok: false,
        error: `Enviame tracking HTTP ${res.status}`,
        statusCode: res.status,
        raw: typeof parsed === "string" ? parsed.slice(0, 500) : parsed,
      };
    }

    const snapshot = mapTrackingResponseToSnapshot(input.identifier, parsed);
    if (!snapshot) {
      return { ok: false, error: "enviame_tracking_unparseable", raw: parsed };
    }
    logger.info("enviame.tracking.ok", {
      identifier: input.identifier,
      status: snapshot.status,
      endpoint: "GET /api/s2/v2/deliveries/{identifier}/tracking",
    });
    return { ok: true, snapshot, raw: parsed };
  } catch (err) {
    const message = err instanceof Error ? err.message : "enviame_network_error";
    logger.error("enviame.tracking.error", { identifier: input.identifier, error: message });
    return { ok: false, error: message };
  }
}

function mapTrackingResponseToSnapshot(
  fallbackId: string,
  raw: unknown,
): CarrierTrackingSnapshot | null {
  const root = asRecord(raw);
  if (!root) return null;
  const data = asRecord(root.data) ?? root;
  const statusBag = asRecord(data.status);
  const trackingNumber =
    readString(data, "tracking_number") ||
    readString(data, "imported_id") ||
    (data.identifier != null ? String(data.identifier) : null) ||
    fallbackId;

  const statusCode = resolveEnviameExternalStatusCode({
    statusId: readNumber(statusBag, "id", "status_id"),
    statusCode: readString(statusBag, "code", "status_code"),
    statusName: readString(statusBag, "name", "status_name"),
  });

  const occurredRaw =
    readString(statusBag, "created_at", "date") ||
    readString(data, "updated_at", "created_at") ||
    new Date().toISOString();

  return {
    trackingNumber,
    status: statusCode,
    occurredAt: normalizeEnviameDate(occurredRaw),
    description: readString(statusBag, "info", "name") ?? statusCode,
  };
}

function asRecord(raw: unknown): Record<string, unknown> | null {
  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    return raw as Record<string, unknown>;
  }
  return null;
}

function readString(bag: Record<string, unknown> | null, ...keys: string[]): string | null {
  if (!bag) return null;
  for (const key of keys) {
    const v = bag[key];
    if (typeof v === "string" && v.trim()) return v.trim();
    if (typeof v === "number" && Number.isFinite(v)) return String(v);
  }
  return null;
}

function readNumber(bag: Record<string, unknown> | null, ...keys: string[]): number | null {
  if (!bag) return null;
  for (const key of keys) {
    const v = bag[key];
    if (typeof v === "number" && Number.isFinite(v)) return v;
    if (typeof v === "string" && v.trim() && !Number.isNaN(Number(v))) return Number(v);
  }
  return null;
}
