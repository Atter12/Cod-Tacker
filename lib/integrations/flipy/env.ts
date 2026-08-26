import "server-only";

import {
  FLIPY_DEFAULT_APP_ACTIVATION_PATH,
  FLIPY_DEFAULT_APP_ORIGIN,
  FLIPY_DEFAULT_EMBED_ORIGIN,
} from "@/lib/integrations/flipy/embed-urls";

/**
 * Flipy Partner API — server env.
 *
 * FLIPY_PARTNER_API_KEY   — shared secret (same as Flipy PARTNER_CODTRACKED_API_KEY)
 * FLIPY_API_BASE_URL      — default https://flipy-backend.vercel.app
 * FLIPY_EMBED_ORIGIN      — partner iframe host (web-app); default https://flipy-panel.vercel.app
 * FLIPY_APP_ORIGIN        — tienda app web / deep links; default https://tienda.flipyexpress.com
 * FLIPY_APP_ACTIVATION_PATH — set-password landing on Flipy app; default /activar-cuenta
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
  appActivationPath: string;
  partnerId: string;
};

export function getFlipyEnv(): FlipyEnv {
  return {
    partnerApiKey: readTrimmed("FLIPY_PARTNER_API_KEY"),
    apiBaseUrl: (readTrimmed("FLIPY_API_BASE_URL") ?? "https://flipy-backend.vercel.app").replace(/\/$/, ""),
    embedOrigin: (readTrimmed("FLIPY_EMBED_ORIGIN") ?? FLIPY_DEFAULT_EMBED_ORIGIN).replace(/\/$/, ""),
    appOrigin: (readTrimmed("FLIPY_APP_ORIGIN") ?? FLIPY_DEFAULT_APP_ORIGIN).replace(
      /\/$/,
      "",
    ),
    appActivationPath:
      readTrimmed("FLIPY_APP_ACTIVATION_PATH") ?? FLIPY_DEFAULT_APP_ACTIVATION_PATH,
    partnerId: readTrimmed("FLIPY_PARTNER_ID") ?? "codtracked",
  };
}

export function isFlipyConfigured(): boolean {
  return Boolean(getFlipyEnv().partnerApiKey);
}
