import { createHash } from "node:crypto";
import { logger } from "@/lib/observability/logger";

export type TikTokEventsCredentials = {
  pixelCode: string;
  accessToken: string;
  testEventCode?: string | null;
  source: "integration" | "env";
};

export type TikTokEventsPurchasePayload = {
  eventId: string;
  /** ISO-8601 timestamp preferred by TikTok pixel/track. */
  eventTimeIso: string;
  value: number;
  currency: string;
  orderId: string;
  email?: string | null;
  phone?: string | null;
  externalId?: string | null;
};

export type TikTokEventsSendResult = {
  mode: "live" | "dry_run";
  ok: boolean;
  statusCode?: number;
  body?: unknown;
  error?: string;
  credentialsSource?: "integration" | "env";
};

export const TIKTOK_EVENTS_MISSING_CREDENTIALS_ERROR =
  "missing_tiktok_events_credentials: set TIKTOK_PIXEL_ID and TIKTOK_ACCESS_TOKEN in Vercel (Preview/Production), or pixel_id/pixel_code + access_token on the store tiktok integration settings";

const TIKTOK_PIXEL_TRACK_URL = "https://business-api.tiktok.com/open_api/v1.3/pixel/track/";

function readString(bag: Record<string, unknown>, ...keys: string[]): string | null {
  for (const key of keys) {
    const raw = bag[key];
    if (typeof raw === "string" && raw.trim()) return raw.trim();
  }
  return null;
}

function readEnvTrimmed(name: string): string | null {
  const raw = process.env[name];
  if (typeof raw === "string" && raw.trim()) return raw.trim();
  return null;
}

/** TikTok Events API: SHA-256 hex of already-normalized value. */
export function hashTikTokEventsValue(normalized: string): string {
  return createHash("sha256").update(normalized, "utf8").digest("hex");
}

export function normalizeTikTokEmail(email: string): string {
  return email.trim().toLowerCase();
}

/** Digits only; include country code when available. */
export function normalizeTikTokPhone(phone: string): string {
  return phone.replace(/\D/g, "");
}

/**
 * Build TikTok `context.user` with hashed PII for CompletePayment matching.
 */
export function buildTikTokEventsUser(payload: TikTokEventsPurchasePayload): Record<string, string> {
  const user: Record<string, string> = {
    external_id: hashTikTokEventsValue((payload.externalId ?? payload.orderId).trim()),
  };

  const email = payload.email?.trim();
  if (email) {
    user.email = hashTikTokEventsValue(normalizeTikTokEmail(email));
  }

  const phone = payload.phone?.trim();
  if (phone) {
    const digits = normalizeTikTokPhone(phone);
    if (digits.length >= 7) {
      user.phone_number = hashTikTokEventsValue(digits);
    }
  }

  return user;
}

/** Extract pixel_code + Events API token from tiktok integration settings/metadata. */
export function readTikTokEventsCredentials(
  settings: unknown,
  metadata: unknown,
): Omit<TikTokEventsCredentials, "source"> | null {
  const bags: Record<string, unknown>[] = [];
  if (settings && typeof settings === "object" && !Array.isArray(settings)) {
    bags.push(settings as Record<string, unknown>);
  }
  if (metadata && typeof metadata === "object" && !Array.isArray(metadata)) {
    bags.push(metadata as Record<string, unknown>);
  }
  let pixelCode: string | null = null;
  let accessToken: string | null = null;
  let testEventCode: string | null = null;
  for (const bag of bags) {
    pixelCode =
      pixelCode ??
      readString(
        bag,
        "pixel_code",
        "pixelCode",
        "pixel_id",
        "pixelId",
        "tiktok_pixel_id",
        "TIKTOK_PIXEL_ID",
      );
    accessToken =
      accessToken ??
      readString(
        bag,
        "access_token",
        "accessToken",
        "events_access_token",
        "tiktok_access_token",
        "TIKTOK_ACCESS_TOKEN",
      );
    testEventCode =
      testEventCode ??
      readString(bag, "test_event_code", "testEventCode", "TIKTOK_TEST_EVENT_CODE");
  }
  if (!pixelCode || !accessToken) return null;
  return { pixelCode, accessToken, testEventCode };
}

/** Server env fallback: TIKTOK_PIXEL_ID + TIKTOK_ACCESS_TOKEN. */
export function readTikTokEventsCredentialsFromEnv(): TikTokEventsCredentials | null {
  const pixelCode = readEnvTrimmed("TIKTOK_PIXEL_ID") ?? readEnvTrimmed("TIKTOK_PIXEL_CODE");
  const accessToken = readEnvTrimmed("TIKTOK_ACCESS_TOKEN");
  if (!pixelCode || !accessToken) return null;
  return {
    pixelCode,
    accessToken,
    testEventCode: readEnvTrimmed("TIKTOK_TEST_EVENT_CODE"),
    source: "env",
  };
}

/**
 * Prefer per-store tiktok integration settings; fall back to Vercel/server env.
 */
export function resolveTikTokEventsCredentials(
  settings: unknown,
  metadata: unknown,
): TikTokEventsCredentials | null {
  const fromIntegration = readTikTokEventsCredentials(settings, metadata);
  if (fromIntegration) {
    return { ...fromIntegration, source: "integration" };
  }
  return readTikTokEventsCredentialsFromEnv();
}

/**
 * Send CompletePayment (Purchase terminal) to TikTok Events API.
 * Missing secrets → dry_run (S12); live HTTP when credentials exist.
 */
export async function sendTikTokEventsPurchase(
  creds: TikTokEventsCredentials | null,
  payload: TikTokEventsPurchasePayload,
): Promise<TikTokEventsSendResult> {
  if (!creds) {
    logger.debug("tiktok.events.purchase.dry_run", {
      event_id: payload.eventId,
      order_id: payload.orderId,
      value: payload.value,
      currency: payload.currency,
      reason: TIKTOK_EVENTS_MISSING_CREDENTIALS_ERROR,
    });
    return {
      mode: "dry_run",
      ok: true,
      error: TIKTOK_EVENTS_MISSING_CREDENTIALS_ERROR,
      body: {
        mode: "dry_run",
        ok: true,
        event: "CompletePayment",
        event_id: payload.eventId,
        error: TIKTOK_EVENTS_MISSING_CREDENTIALS_ERROR,
        required_env: ["TIKTOK_PIXEL_ID", "TIKTOK_ACCESS_TOKEN"],
        optional_env: ["TIKTOK_TEST_EVENT_CODE"],
      },
    };
  }

  const user = buildTikTokEventsUser(payload);
  const body: Record<string, unknown> = {
    pixel_code: creds.pixelCode,
    event: "CompletePayment",
    event_id: payload.eventId,
    timestamp: payload.eventTimeIso,
    context: { user },
    properties: {
      currency: payload.currency,
      value: payload.value,
      contents: [
        {
          content_id: payload.orderId,
          content_type: "product",
          quantity: 1,
          price: payload.value,
        },
      ],
    },
  };
  if (creds.testEventCode) {
    body.test_event_code = creds.testEventCode;
  }

  try {
    const res = await fetch(TIKTOK_PIXEL_TRACK_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Access-Token": creds.accessToken,
      },
      body: JSON.stringify(body),
    });
    const text = await res.text();
    let parsed: unknown = text;
    try {
      parsed = JSON.parse(text) as unknown;
    } catch {
      /* keep text */
    }

    const code =
      parsed && typeof parsed === "object" && !Array.isArray(parsed)
        ? (parsed as { code?: unknown }).code
        : undefined;
    const apiOk = res.ok && (code === undefined || code === 0);

    if (!apiOk) {
      logger.warn("tiktok.events.purchase.failed", {
        event_id: payload.eventId,
        status: res.status,
        credentials_source: creds.source,
        body: typeof parsed === "string" ? parsed.slice(0, 500) : parsed,
      });
      return {
        mode: "live",
        ok: false,
        statusCode: res.status,
        body: parsed,
        error: `TikTok Events API HTTP ${res.status}${code !== undefined ? ` code=${String(code)}` : ""}`,
        credentialsSource: creds.source,
      };
    }

    logger.info("tiktok.events.purchase.sent", {
      event_id: payload.eventId,
      order_id: payload.orderId,
      status: res.status,
      credentials_source: creds.source,
      user_keys: Object.keys(user),
    });
    return {
      mode: "live",
      ok: true,
      statusCode: res.status,
      body: parsed,
      credentialsSource: creds.source,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : "tiktok_events_network_error";
    logger.error("tiktok.events.purchase.error", {
      event_id: payload.eventId,
      error: message,
      credentials_source: creds.source,
    });
    return { mode: "live", ok: false, error: message, credentialsSource: creds.source };
  }
}
