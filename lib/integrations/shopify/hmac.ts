import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Verify Shopify OAuth callback HMAC.
 * @see https://shopify.dev/docs/apps/build/authentication-authorization/access-tokens/authorization-code-grant
 */
export function verifyShopifyOAuthHmac(
  query: Record<string, string | undefined>,
  clientSecret: string,
): boolean {
  const hmac = query.hmac;
  if (!hmac) return false;

  const message = Object.keys(query)
    .filter((key) => key !== "hmac" && key !== "signature" && query[key] != null)
    .sort()
    .map((key) => `${key}=${query[key]}`)
    .join("&");

  const digest = createHmac("sha256", clientSecret).update(message).digest("hex");
  try {
    const a = Buffer.from(digest, "utf8");
    const b = Buffer.from(hmac, "utf8");
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

/** Verify X-Shopify-Hmac-Sha256 webhook header (base64 digest of raw body). */
export function verifyShopifyWebhookHmac(
  rawBody: string | Buffer,
  hmacHeader: string | null,
  clientSecret: string,
): boolean {
  if (!hmacHeader) return false;
  const digest = createHmac("sha256", clientSecret).update(rawBody).digest("base64");
  try {
    const a = Buffer.from(digest, "utf8");
    const b = Buffer.from(hmacHeader, "utf8");
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}
