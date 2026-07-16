import { logger } from "@/lib/observability/logger";

export type MetaCapiCredentials = {
  pixelId: string;
  accessToken: string;
  testEventCode?: string | null;
};

export type MetaCapiPurchasePayload = {
  eventId: string;
  eventTimeUnix: number;
  value: number;
  currency: string;
  orderId: string;
  email?: string | null;
  phone?: string | null;
};

export type MetaCapiSendResult = {
  mode: "live" | "dry_run";
  ok: boolean;
  statusCode?: number;
  body?: unknown;
  error?: string;
};

function readString(bag: Record<string, unknown>, ...keys: string[]): string | null {
  for (const key of keys) {
    const raw = bag[key];
    if (typeof raw === "string" && raw.trim()) return raw.trim();
  }
  return null;
}

/** Extract Pixel ID + CAPI token from integration settings/metadata when present. */
export function readMetaCapiCredentials(
  settings: unknown,
  metadata: unknown,
): MetaCapiCredentials | null {
  const bags: Record<string, unknown>[] = [];
  if (settings && typeof settings === "object" && !Array.isArray(settings)) {
    bags.push(settings as Record<string, unknown>);
  }
  if (metadata && typeof metadata === "object" && !Array.isArray(metadata)) {
    bags.push(metadata as Record<string, unknown>);
  }
  let pixelId: string | null = null;
  let accessToken: string | null = null;
  let testEventCode: string | null = null;
  for (const bag of bags) {
    pixelId =
      pixelId ??
      readString(bag, "pixel_id", "pixelId", "meta_pixel_id", "META_PIXEL_ID");
    accessToken =
      accessToken ??
      readString(
        bag,
        "capi_access_token",
        "access_token",
        "meta_capi_token",
        "META_CAPI_ACCESS_TOKEN",
      );
    testEventCode =
      testEventCode ?? readString(bag, "test_event_code", "testEventCode", "META_TEST_EVENT_CODE");
  }
  if (!pixelId || !accessToken) return null;
  return { pixelId, accessToken, testEventCode };
}

/**
 * Send Purchase to Meta Conversions API when credentials exist; otherwise dry-run log.
 */
export async function sendMetaCapiPurchase(
  creds: MetaCapiCredentials | null,
  payload: MetaCapiPurchasePayload,
): Promise<MetaCapiSendResult> {
  if (!creds) {
    logger.info("meta.capi.purchase.dry_run", {
      event_id: payload.eventId,
      order_id: payload.orderId,
      value: payload.value,
      currency: payload.currency,
    });
    return { mode: "dry_run", ok: true };
  }

  const url = new URL(`https://graph.facebook.com/v21.0/${encodeURIComponent(creds.pixelId)}/events`);
  url.searchParams.set("access_token", creds.accessToken);

  const userData: Record<string, string> = {};
  // Meta expects hashed PII; without hashing libs we omit email/phone in live sends
  // and rely on event_id + custom_data.order_id for dedupe. Dry-run still logs presence.
  if (payload.email) userData.em_present = "1";
  if (payload.phone) userData.ph_present = "1";

  const body: Record<string, unknown> = {
    data: [
      {
        event_name: "Purchase",
        event_time: payload.eventTimeUnix,
        event_id: payload.eventId,
        action_source: "other",
        user_data: userData,
        custom_data: {
          currency: payload.currency,
          value: payload.value,
          order_id: payload.orderId,
        },
      },
    ],
  };
  if (creds.testEventCode) {
    body.test_event_code = creds.testEventCode;
  }

  try {
    const res = await fetch(url.toString(), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const text = await res.text();
    let parsed: unknown = text;
    try {
      parsed = JSON.parse(text) as unknown;
    } catch {
      /* keep text */
    }
    if (!res.ok) {
      logger.warn("meta.capi.purchase.failed", {
        event_id: payload.eventId,
        status: res.status,
        body: typeof parsed === "string" ? parsed.slice(0, 500) : parsed,
      });
      return {
        mode: "live",
        ok: false,
        statusCode: res.status,
        body: parsed,
        error: `Meta CAPI HTTP ${res.status}`,
      };
    }
    logger.info("meta.capi.purchase.sent", {
      event_id: payload.eventId,
      order_id: payload.orderId,
      status: res.status,
    });
    return { mode: "live", ok: true, statusCode: res.status, body: parsed };
  } catch (err) {
    const message = err instanceof Error ? err.message : "meta_capi_network_error";
    logger.error("meta.capi.purchase.error", { event_id: payload.eventId, error: message });
    return { mode: "live", ok: false, error: message };
  }
}
