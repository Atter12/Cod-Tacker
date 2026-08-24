import "server-only";

/**
 * Flipy Partner API — server env.
 *
 * FLIPY_PARTNER_API_KEY   — shared secret (same as Flipy PARTNER_CODTRACKED_API_KEY)
 * FLIPY_API_BASE_URL      — default https://api.flipy.pe
 * FLIPY_EMBED_ORIGIN      — iframe origin (F2/F3 partner embed); default https://app.flipy.pe
 * FLIPY_APP_ORIGIN        — app tienda web / deep links (pujas); default https://tienda.flipyexpress.com
 */

function readTrimmed(name: string): string | null {
  const raw = process.env[name];
  if (typeof raw === "string" && raw.trim()) return raw.trim();
  return null;
}

export const FLIPY_MISSING_PARTNER_KEY_ERROR =
  "missing_flipy_partner_api_key: set FLIPY_PARTNER_API_KEY in Vercel";

export type FlipyEnv = {
  partnerApiKey: string | null;
  apiBaseUrl: string;
  embedOrigin: string;
  appOrigin: string;
  partnerId: string;
};

export function getFlipyEnv(): FlipyEnv {
  return {
    partnerApiKey: readTrimmed("FLIPY_PARTNER_API_KEY"),
    apiBaseUrl: (readTrimmed("FLIPY_API_BASE_URL") ?? "https://api.flipy.pe").replace(/\/$/, ""),
    embedOrigin: (readTrimmed("FLIPY_EMBED_ORIGIN") ?? "https://app.flipy.pe").replace(/\/$/, ""),
    appOrigin: (readTrimmed("FLIPY_APP_ORIGIN") ?? "https://tienda.flipyexpress.com").replace(
      /\/$/,
      "",
    ),
    partnerId: readTrimmed("FLIPY_PARTNER_ID") ?? "codtracked",
  };
}

export function isFlipyConfigured(): boolean {
  return Boolean(getFlipyEnv().partnerApiKey);
}
