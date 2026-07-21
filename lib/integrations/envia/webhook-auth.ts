import { createHmac, timingSafeEqual } from "node:crypto";

/** HMAC per Envia docs: v1=HMAC(ts + "." + event + "." + body_json, secret) */
export function signEnviaWebhook(secret: string, timestamp: string, event: string, body: string): string {
  const payload = `${timestamp}.${event}.${body}`;
  const digest = createHmac("sha256", secret).update(payload, "utf8").digest("hex");
  return `v1=${digest}`;
}

function signaturesMatch(provided: string, expected: string): boolean {
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  try {
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

function equalString(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ba.length !== bb.length) return false;
  try {
    return timingSafeEqual(ba, bb);
  } catch {
    return false;
  }
}

function bearerToken(header: string | null): string | null {
  if (!header) return null;
  const m = /^Bearer\s+(.+)$/i.exec(header.trim());
  return m?.[1]?.trim() || null;
}

/**
 * S15 — Production must require ENVIA_WEBHOOK_SECRET.
 * Preview/development stay open when secret is unset (Envia UI "Probar").
 *
 * Overrides:
 *   ENVIA_WEBHOOK_REQUIRE_SECRET=true  → always strict
 *   ENVIA_WEBHOOK_ALLOW_OPEN=true      → allow open even on production (emergency only)
 */
export function allowEnviaOpenWebhookAuth(
  env: NodeJS.Dict<string | undefined> = process.env,
): boolean {
  if (env.ENVIA_WEBHOOK_ALLOW_OPEN === "true") return true;
  if (env.ENVIA_WEBHOOK_REQUIRE_SECRET === "true") return false;
  return env.VERCEL_ENV !== "production";
}

export function verifyEnviaWebhookAuth(input: {
  rawBody: string;
  webhookSecret: string | null;
  apiToken: string | null;
  authorizationHeader: string | null;
  signatureHeader: string | null;
  timestampHeader: string | null;
  eventHeader: string | null;
  /**
   * When true and secret unset, allow (Preview / UI Probar).
   * Default: derived from VERCEL_ENV via allowEnviaOpenWebhookAuth().
   */
  allowOpenWhenSecretUnset?: boolean;
}): { ok: true; open?: boolean } | { ok: false; status: number; error: string } {
  const secret = input.webhookSecret?.trim() || null;
  const allowOpen =
    input.allowOpenWhenSecretUnset ?? allowEnviaOpenWebhookAuth();

  if (!secret) {
    if (!allowOpen) {
      return {
        ok: false,
        status: 401,
        error: "ENVIA_WEBHOOK_SECRET requerido en Production (webhook rechazado sin secret)",
      };
    }
    return { ok: true, open: true };
  }

  const bearer = bearerToken(input.authorizationHeader);
  if (bearer && equalString(bearer, secret)) {
    return { ok: true };
  }
  if (bearer && input.apiToken && equalString(bearer, input.apiToken)) {
    return { ok: true };
  }

  const sigHeader = input.signatureHeader?.trim();
  if (sigHeader && input.timestampHeader) {
    const event = input.eventHeader?.trim() || "tracking.simple";
    const expected = signEnviaWebhook(secret, input.timestampHeader, event, input.rawBody);
    if (signaturesMatch(sigHeader, expected)) {
      return { ok: true };
    }
  }

  return {
    status: 401,
    ok: false,
    error: "Webhook auth inválido (Bearer o X-Webhook-Signature)",
  };
}
