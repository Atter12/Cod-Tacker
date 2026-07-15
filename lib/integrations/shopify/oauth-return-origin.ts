/**
 * Safe post-OAuth browser return origin.
 * Shopify redirect_uri stays on SHOPIFY_APP_URL / production; we bounce the user
 * back to the preview (or whichever host started connect) when allowlisted.
 */

export function extractRequestOrigin(requestUrl: string): string {
  return new URL(requestUrl).origin;
}

function normalizeOrigin(raw: string): string | null {
  try {
    const url = new URL(raw.includes("://") ? raw : `https://${raw}`);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    return url.origin;
  } catch {
    return null;
  }
}

function isLocalhostOrigin(origin: string): boolean {
  try {
    const { hostname, protocol } = new URL(origin);
    if (protocol !== "http:" && protocol !== "https:") return false;
    return hostname === "localhost" || hostname === "127.0.0.1";
  } catch {
    return false;
  }
}

/** Vercel preview / deployment hosts (https only). */
function isVercelDeploymentOrigin(origin: string): boolean {
  try {
    const { hostname, protocol } = new URL(origin);
    if (protocol !== "https:") return false;
    return hostname.endsWith(".vercel.app");
  } catch {
    return false;
  }
}

/**
 * Returns a safe origin to send the browser after OAuth, or null if candidate is not allowed.
 */
export function resolveAllowedShopifyOAuthReturnOrigin(
  candidate: string | null | undefined,
  configuredAppUrls: Array<string | undefined | null>,
): string | null {
  const origin = typeof candidate === "string" ? normalizeOrigin(candidate.trim()) : null;
  if (!origin) return null;

  const allowed = new Set<string>();
  for (const raw of configuredAppUrls) {
    if (!raw) continue;
    const o = normalizeOrigin(raw.trim());
    if (o) allowed.add(o);
  }

  if (allowed.has(origin)) return origin;
  if (isLocalhostOrigin(origin)) return origin;
  if (isVercelDeploymentOrigin(origin)) return origin;
  return null;
}
