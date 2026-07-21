/**
 * Meta Marketing API / Ads Insights — server env + integration settings.
 *
 * Vercel (Preview/Production):
 *   META_ADS_ACCESS_TOKEN   — User/System token with ads_read
 *   META_AD_ACCOUNT_ID      — act_… or numeric account id
 *   META_ADS_API_VERSION    — optional; default v21.0
 *   META_ADS_CURRENCY       — optional fallback when Insights omit currency (default PEN)
 *
 * Per-store (integrations.settings / metadata for provider=meta):
 *   ads_access_token / access_token / marketing_access_token
 *   ad_account_id / account_id / act_id
 */

function readTrimmed(name: string): string | null {
  const raw = process.env[name];
  if (typeof raw === "string" && raw.trim()) return raw.trim();
  return null;
}

function readString(bag: Record<string, unknown>, ...keys: string[]): string | null {
  for (const key of keys) {
    const raw = bag[key];
    if (typeof raw === "string" && raw.trim()) return raw.trim();
    if (typeof raw === "number" && Number.isFinite(raw)) return String(raw);
  }
  return null;
}

export const META_ADS_MISSING_CREDENTIALS_ERROR =
  "missing_meta_ads_credentials: set META_ADS_ACCESS_TOKEN and META_AD_ACCOUNT_ID in Vercel, or ads_access_token + ad_account_id on the store meta integration settings";

export type MetaAdsCredentials = {
  accessToken: string;
  /** Normalized with act_ prefix. */
  adAccountId: string;
  apiVersion: string;
  currencyFallback: string;
  source: "integration" | "env";
};

/** Ensure Meta ad account ids use the act_ prefix. */
export function normalizeMetaAdAccountId(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return trimmed;
  if (trimmed.startsWith("act_")) return trimmed;
  return `act_${trimmed.replace(/^act_/i, "")}`;
}

export function getMetaAdsEnvDefaults(): {
  apiVersion: string;
  currencyFallback: string;
} {
  return {
    apiVersion: readTrimmed("META_ADS_API_VERSION") ?? "v21.0",
    currencyFallback: (readTrimmed("META_ADS_CURRENCY") ?? "PEN").slice(0, 3).toUpperCase(),
  };
}

export function readMetaAdsCredentialsFromEnv(): Omit<MetaAdsCredentials, "source"> | null {
  const accessToken = readTrimmed("META_ADS_ACCESS_TOKEN");
  const accountRaw = readTrimmed("META_AD_ACCOUNT_ID");
  if (!accessToken || !accountRaw) return null;
  const defaults = getMetaAdsEnvDefaults();
  return {
    accessToken,
    adAccountId: normalizeMetaAdAccountId(accountRaw),
    apiVersion: defaults.apiVersion,
    currencyFallback: defaults.currencyFallback,
  };
}

export function readMetaAdsCredentials(
  settings: unknown,
  metadata: unknown,
): Omit<MetaAdsCredentials, "source"> | null {
  const bags: Record<string, unknown>[] = [];
  if (settings && typeof settings === "object" && !Array.isArray(settings)) {
    bags.push(settings as Record<string, unknown>);
  }
  if (metadata && typeof metadata === "object" && !Array.isArray(metadata)) {
    bags.push(metadata as Record<string, unknown>);
  }

  let accessToken: string | null = null;
  let accountRaw: string | null = null;
  for (const bag of bags) {
    accessToken =
      accessToken ??
      readString(
        bag,
        "ads_access_token",
        "marketing_access_token",
        "meta_ads_access_token",
        "META_ADS_ACCESS_TOKEN",
        "access_token",
      );
    accountRaw =
      accountRaw ??
      readString(
        bag,
        "ad_account_id",
        "ads_account_id",
        "account_id",
        "act_id",
        "META_AD_ACCOUNT_ID",
      );
  }

  if (!accessToken || !accountRaw) return null;
  const defaults = getMetaAdsEnvDefaults();
  return {
    accessToken,
    adAccountId: normalizeMetaAdAccountId(accountRaw),
    apiVersion: defaults.apiVersion,
    currencyFallback: defaults.currencyFallback,
  };
}

export function resolveMetaAdsCredentials(
  settings: unknown,
  metadata: unknown,
): MetaAdsCredentials | null {
  const fromIntegration = readMetaAdsCredentials(settings, metadata);
  if (fromIntegration) return { ...fromIntegration, source: "integration" };
  const fromEnv = readMetaAdsCredentialsFromEnv();
  if (fromEnv) return { ...fromEnv, source: "env" };
  return null;
}
