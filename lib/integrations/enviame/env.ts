import "server-only";

/**
 * Enviame (S11) — server env. Do not invent values.
 *
 * Vercel debt (Preview/Production):
 *   ENVIAME_API_KEY            — seller/company api-key (header `api-key`) for GET tracking
 *   ENVIAME_WEBHOOK_SECRET     — shared secret Enviame sends as custom header (x-enviame-webhook-secret)
 *   ENVIAME_API_BASE_URL       — optional; default https://api.enviame.io (stage: https://stage.api.enviame.io)
 *   ENVIAME_COMPANY_ID         — optional; used when resolving tenant / docs
 *   ENVIAME_DEFAULT_STORE_ID   — optional UUID fallback when webhook cannot match tracking/order
 *
 * Docs: https://docs.enviame.io/docs/v2 · https://docs.enviame.io/docs/webhooks/
 */

export const ENVIAME_MISSING_API_KEY_ERROR =
  "missing_enviame_api_key: set ENVIAME_API_KEY in Vercel (or api_key on enviame integration settings)";

export const ENVIAME_MISSING_WEBHOOK_SECRET_ERROR =
  "missing_enviame_webhook_secret: set ENVIAME_WEBHOOK_SECRET in Vercel and configure the same value as a custom header in Enviame webhooks";

function readTrimmed(name: string): string | null {
  const raw = process.env[name];
  if (typeof raw === "string" && raw.trim()) return raw.trim();
  return null;
}

export type EnviameEnv = {
  apiKey: string | null;
  webhookSecret: string | null;
  apiBaseUrl: string;
  companyId: string | null;
  defaultStoreId: string | null;
};

export function getEnviameEnv(): EnviameEnv {
  const base = readTrimmed("ENVIAME_API_BASE_URL") ?? "https://api.enviame.io";
  return {
    apiKey: readTrimmed("ENVIAME_API_KEY"),
    webhookSecret: readTrimmed("ENVIAME_WEBHOOK_SECRET"),
    apiBaseUrl: base.replace(/\/$/, ""),
    companyId: readTrimmed("ENVIAME_COMPANY_ID"),
    defaultStoreId: readTrimmed("ENVIAME_DEFAULT_STORE_ID"),
  };
}

/** Prefer integration settings.api_key; fall back to ENVIAME_API_KEY. */
export function resolveEnviameApiKey(settings: unknown, metadata: unknown): string | null {
  const bags: Record<string, unknown>[] = [];
  if (settings && typeof settings === "object" && !Array.isArray(settings)) {
    bags.push(settings as Record<string, unknown>);
  }
  if (metadata && typeof metadata === "object" && !Array.isArray(metadata)) {
    bags.push(metadata as Record<string, unknown>);
  }
  for (const bag of bags) {
    for (const key of ["api_key", "apiKey", "enviame_api_key", "ENVIAME_API_KEY"]) {
      const v = bag[key];
      if (typeof v === "string" && v.trim()) return v.trim();
    }
  }
  return getEnviameEnv().apiKey;
}
