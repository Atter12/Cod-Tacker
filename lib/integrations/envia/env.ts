import "server-only";

/**
 * Envia.com — server env. Do not invent values.
 *
 * Vercel (Preview/Production):
 *   ENVIA_API_TOKEN           — optional global fallback (prefer token on integrations row)
 *   ENVIA_WEBHOOK_SECRET      — optional; if set, require Authorization Bearer or valid HMAC signature
 *   ENVIA_API_BASE_URL        — optional; default https://api.envia.com (sandbox: https://api-test.envia.com)
 *   ENVIA_DEFAULT_STORE_ID    — demo only; last-resort store pin when tenant cannot be resolved
 *
 * Webhook URLs (register in Envia → Desarrolladores → Webhooks, tipo onShipmentStatusUpdate):
 *   Global (multi-tenant resolve):  {APP_URL}/api/webhooks/envia
 *   Per-store (explicit):           {APP_URL}/api/webhooks/envia/{agencySlug}/{storeSlug}
 *
 * Docs: https://docs.envia.com/docs/webhooks · https://docs.envia.com/docs/authentication
 */

export { buildEnviaWebhookUrls, type EnviaWebhookUrls } from "@/lib/integrations/envia/webhook-urls";

export const ENVIA_MISSING_TOKEN_ERROR =
  "missing_envia_api_token: set ENVIA_API_TOKEN in Vercel (Desarrolladores → Acceso de API)";

function readTrimmed(name: string): string | null {
  const raw = process.env[name];
  if (typeof raw === "string" && raw.trim()) return raw.trim();
  return null;
}

export type EnviaEnv = {
  apiToken: string | null;
  webhookSecret: string | null;
  apiBaseUrl: string;
  defaultStoreId: string | null;
};

export function getEnviaEnv(): EnviaEnv {
  const base = readTrimmed("ENVIA_API_BASE_URL") ?? "https://api.envia.com";
  return {
    apiToken: readTrimmed("ENVIA_API_TOKEN"),
    webhookSecret: readTrimmed("ENVIA_WEBHOOK_SECRET"),
    apiBaseUrl: base.replace(/\/$/, ""),
    defaultStoreId: readTrimmed("ENVIA_DEFAULT_STORE_ID"),
  };
}

/** Prefer integration settings token; fall back to ENVIA_API_TOKEN. */
export function resolveEnviaApiToken(settings: unknown, metadata: unknown): string | null {
  const bags: Record<string, unknown>[] = [];
  if (settings && typeof settings === "object" && !Array.isArray(settings)) {
    bags.push(settings as Record<string, unknown>);
  }
  if (metadata && typeof metadata === "object" && !Array.isArray(metadata)) {
    bags.push(metadata as Record<string, unknown>);
  }
  for (const bag of bags) {
    for (const key of ["api_token", "access_token", "token", "ENVIA_API_TOKEN"]) {
      const v = bag[key];
      if (typeof v === "string" && v.trim()) return v.trim();
    }
  }
  return getEnviaEnv().apiToken;
}
