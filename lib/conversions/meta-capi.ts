import { createHash } from "node:crypto";
import { logger } from "@/lib/observability/logger";

export type MetaCapiCredentials = {
  pixelId: string;
  accessToken: string;
  testEventCode?: string | null;
  /** Where pixel/token were resolved from (for logs / conversion_events custom_data). */
  source: "integration" | "env";
};

export type MetaCapiPurchasePayload = {
  eventId: string;
  eventTimeUnix: number;
  value: number;
  currency: string;
  orderId: string;
  email?: string | null;
  phone?: string | null;
  /** ISO-3166 alpha-2 (sent unhashed per Meta docs). */
  countryCode?: string | null;
  city?: string | null;
};

export type MetaCapiSendResult = {
  /** `live` = attempted Graph API (or refused for missing secrets). `dry_run` reserved for explicit opt-in only. */
  mode: "live" | "dry_run";
  ok: boolean;
  statusCode?: number;
  body?: unknown;
  error?: string;
  credentialsSource?: "integration" | "env";
};

/** Stable error when Vercel/env (or integration settings) lack Pixel + CAPI token. */
export const META_CAPI_MISSING_CREDENTIALS_ERROR =
  "missing_meta_capi_credentials: set META_PIXEL_ID and META_CAPI_ACCESS_TOKEN in Vercel (Preview/Production), or pixel_id + capi_access_token on the store meta integration settings";

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

/** Meta CAPI: SHA-256 hex of already-normalized value. */
export function hashMetaCapiValue(normalized: string): string {
  return createHash("sha256").update(normalized, "utf8").digest("hex");
}

export function normalizeMetaEmail(email: string): string {
  return email.trim().toLowerCase();
}

/** Digits only; include country code when available (Meta recommendation). */
export function normalizeMetaPhone(phone: string): string {
  return phone.replace(/\D/g, "");
}

/**
 * Build Meta `user_data` with hashed PII.
 * Always includes `external_id` so the request satisfies customer-info matching requirements
 * (error_subcode 2804050 when empty / fake keys like em_present).
 */
export function buildMetaCapiUserData(payload: MetaCapiPurchasePayload): Record<string, string> {
  const userData: Record<string, string> = {
    external_id: hashMetaCapiValue(payload.orderId.trim()),
  };

  const email = payload.email?.trim();
  if (email) {
    userData.em = hashMetaCapiValue(normalizeMetaEmail(email));
  }

  const phone = payload.phone?.trim();
  if (phone) {
    const digits = normalizeMetaPhone(phone);
    if (digits.length >= 7) {
      userData.ph = hashMetaCapiValue(digits);
    }
  }

  const country = payload.countryCode?.trim();
  if (country && country.length === 2) {
    userData.country = country.toLowerCase();
  }

  const city = payload.city?.trim();
  if (city) {
    userData.ct = hashMetaCapiValue(city.toLowerCase());
  }

  return userData;
}

/** Extract Pixel ID + CAPI token from integration settings/metadata when present. */
export function readMetaCapiCredentials(
  settings: unknown,
  metadata: unknown,
): Omit<MetaCapiCredentials, "source"> | null {
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

/** Server env fallback (Vercel): META_PIXEL_ID + META_CAPI_ACCESS_TOKEN. */
export function readMetaCapiCredentialsFromEnv(): MetaCapiCredentials | null {
  const pixelId = readEnvTrimmed("META_PIXEL_ID");
  const accessToken = readEnvTrimmed("META_CAPI_ACCESS_TOKEN");
  if (!pixelId || !accessToken) return null;
  return {
    pixelId,
    accessToken,
    testEventCode: readEnvTrimmed("META_TEST_EVENT_CODE"),
    source: "env",
  };
}

/**
 * Prefer per-store integration settings; fall back to Vercel/server env.
 * Does not invent credentials — returns null when both sources are incomplete.
 */
export function resolveMetaCapiCredentials(
  settings: unknown,
  metadata: unknown,
): MetaCapiCredentials | null {
  const fromIntegration = readMetaCapiCredentials(settings, metadata);
  if (fromIntegration) {
    return { ...fromIntegration, source: "integration" };
  }
  return readMetaCapiCredentialsFromEnv();
}

/**
 * Send Purchase to Meta Conversions API when credentials exist.
 * Missing secrets → live attempt refused with failed (not dry_run).
 */
export async function sendMetaCapiPurchase(
  creds: MetaCapiCredentials | null,
  payload: MetaCapiPurchasePayload,
): Promise<MetaCapiSendResult> {
  if (!creds) {
    logger.warn("meta.capi.purchase.failed", {
      event_id: payload.eventId,
      order_id: payload.orderId,
      error: META_CAPI_MISSING_CREDENTIALS_ERROR,
      value: payload.value,
      currency: payload.currency,
    });
    return {
      mode: "live",
      ok: false,
      error: META_CAPI_MISSING_CREDENTIALS_ERROR,
      body: {
        mode: "live",
        ok: false,
        error: META_CAPI_MISSING_CREDENTIALS_ERROR,
        required_env: ["META_PIXEL_ID", "META_CAPI_ACCESS_TOKEN"],
        optional_env: ["META_TEST_EVENT_CODE"],
      },
    };
  }

  const url = new URL(`https://graph.facebook.com/v21.0/${encodeURIComponent(creds.pixelId)}/events`);
  url.searchParams.set("access_token", creds.accessToken);

  const userData = buildMetaCapiUserData(payload);

  const body: Record<string, unknown> = {
    data: [
      {
        event_name: "Purchase",
        event_time: payload.eventTimeUnix,
        event_id: payload.eventId,
        // COD ops are not browser pixel; "other" is valid when user_data has match keys.
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
        credentials_source: creds.source,
        body: typeof parsed === "string" ? parsed.slice(0, 500) : parsed,
      });
      return {
        mode: "live",
        ok: false,
        statusCode: res.status,
        body: parsed,
        error: `Meta CAPI HTTP ${res.status}`,
        credentialsSource: creds.source,
      };
    }
    logger.info("meta.capi.purchase.sent", {
      event_id: payload.eventId,
      order_id: payload.orderId,
      status: res.status,
      credentials_source: creds.source,
      user_data_keys: Object.keys(userData),
    });
    return {
      mode: "live",
      ok: true,
      statusCode: res.status,
      body: parsed,
      credentialsSource: creds.source,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : "meta_capi_network_error";
    logger.error("meta.capi.purchase.error", {
      event_id: payload.eventId,
      error: message,
      credentials_source: creds.source,
    });
    return { mode: "live", ok: false, error: message, credentialsSource: creds.source };
  }
}
