import { createHmac, timingSafeEqual } from "node:crypto";

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

/** HMAC SHA256 body — header `X-Flipy-Signature: sha256=<hex>`. */
export function signFlipyWebhook(secret: string, rawBody: string): string {
  const digest = createHmac("sha256", secret).update(rawBody, "utf8").digest("hex");
  return `sha256=${digest}`;
}

export function verifyFlipyWebhookSignature(
  rawBody: string,
  signatureHeader: string | null | undefined,
  secret: string,
): boolean {
  const provided = signatureHeader?.trim() ?? "";
  if (!provided || !secret.trim()) return false;
  const expected = signFlipyWebhook(secret.trim(), rawBody);
  if (signaturesMatch(provided, expected)) return true;
  const bare = expected.replace(/^sha256=/i, "");
  return signaturesMatch(provided.replace(/^sha256=/i, ""), bare);
}
