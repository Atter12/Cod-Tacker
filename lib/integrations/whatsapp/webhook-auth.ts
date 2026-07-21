import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Meta WhatsApp webhooks:
 * - GET: hub.mode=subscribe & hub.verify_token & hub.challenge
 * - POST: X-Hub-Signature-256: sha256=<hex hmac of raw body with app secret>
 */

export function allowWhatsAppOpenWebhookAuth(
  env: NodeJS.Dict<string | undefined> = process.env,
): boolean {
  if (env.WHATSAPP_WEBHOOK_ALLOW_OPEN === "true") return true;
  if (env.WHATSAPP_WEBHOOK_REQUIRE_SECRET === "true") return false;
  return env.VERCEL_ENV !== "production";
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

export function verifyWhatsAppWebhookChallenge(input: {
  mode: string | null;
  verifyToken: string | null;
  challenge: string | null;
  expectedVerifyToken: string | null;
}): { ok: true; challenge: string } | { ok: false; status: number; error: string } {
  if (input.mode !== "subscribe") {
    return { ok: false, status: 400, error: "hub.mode must be subscribe" };
  }
  const expected = input.expectedVerifyToken?.trim() || null;
  const provided = input.verifyToken?.trim() || null;
  if (!expected) {
    return { ok: false, status: 503, error: "WHATSAPP_VERIFY_TOKEN not configured" };
  }
  if (!provided || !equalString(provided, expected)) {
    return { ok: false, status: 403, error: "verify_token mismatch" };
  }
  if (!input.challenge) {
    return { ok: false, status: 400, error: "missing hub.challenge" };
  }
  return { ok: true, challenge: input.challenge };
}

export function signWhatsAppWebhookBody(appSecret: string, rawBody: string): string {
  const digest = createHmac("sha256", appSecret).update(rawBody, "utf8").digest("hex");
  return `sha256=${digest}`;
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

/**
 * Production requires WHATSAPP_APP_SECRET (same posture as Envia S15).
 * Preview/dev may accept unsigned when secret unset unless REQUIRE_SECRET=true.
 */
export function verifyWhatsAppWebhookSignature(input: {
  rawBody: string;
  appSecret: string | null;
  signatureHeader: string | null;
  allowOpenWhenSecretUnset?: boolean;
}): { ok: true; open?: boolean } | { ok: false; status: number; error: string } {
  const secret = input.appSecret?.trim() || null;
  const allowOpen = input.allowOpenWhenSecretUnset ?? allowWhatsAppOpenWebhookAuth();

  if (!secret) {
    if (!allowOpen) {
      return {
        ok: false,
        status: 401,
        error: "WHATSAPP_APP_SECRET requerido en Production (webhook rechazado sin firma)",
      };
    }
    return { ok: true, open: true };
  }

  const header = input.signatureHeader?.trim() || null;
  if (!header) {
    return { ok: false, status: 401, error: "Missing X-Hub-Signature-256" };
  }

  const expected = signWhatsAppWebhookBody(secret, input.rawBody);
  if (!signaturesMatch(header, expected)) {
    return { ok: false, status: 401, error: "Invalid X-Hub-Signature-256" };
  }
  return { ok: true };
}
