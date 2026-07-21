/**
 * TikTok Ads Reporting (S17 — ad_spend_daily live).
 *
 * Distinct from Events API credentials (TIKTOK_PIXEL_ID / TIKTOK_ACCESS_TOKEN),
 * which are used only for Purchase / CompletePayment.
 *
 * Vercel (Preview/Production):
 *   TIKTOK_ADS_ACCESS_TOKEN — Marketing API token with ads reporting scope
 *   TIKTOK_ADVERTISER_ID    — Advertiser id to pull daily spend
 *   TIKTOK_ADS_API_VERSION  — optional; default v1.3
 *   TIKTOK_ADS_CURRENCY     — fallback currency when report omits it (default PEN)
 *
 * Per-store (integrations.settings / metadata for provider=tiktok):
 *   ads_access_token / tiktok_ads_access_token / marketing_access_token
 *   advertiser_id / tiktok_advertiser_id / ad_account_id
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

export const TIKTOK_ADS_MISSING_CREDENTIALS_ERROR =
  "missing_tiktok_ads_credentials: set TIKTOK_ADS_ACCESS_TOKEN and TIKTOK_ADVERTISER_ID in Vercel, or ads_access_token + advertiser_id on the store tiktok integration settings";

export type TikTokAdsCredentials = {
  accessToken: string;
  advertiserId: string;
  apiVersion: string;
  currencyFallback: string;
  source: "integration" | "env";
};

/** Normalize advertiser id to digits-only string TikTok expects. */
export function normalizeTikTokAdvertiserId(raw: string): string {
  return raw.trim().replace(/^act_/i, "");
}

export function getTikTokAdsEnvDefaults(): {
  apiVersion: string;
  currencyFallback: string;
} {
  return {
    apiVersion: readTrimmed("TIKTOK_ADS_API_VERSION") ?? "v1.3",
    currencyFallback: (readTrimmed("TIKTOK_ADS_CURRENCY") ?? "PEN").slice(0, 3).toUpperCase(),
  };
}

export function readTikTokAdsCredentialsFromEnv(): Omit<TikTokAdsCredentials, "source"> | null {
  const accessToken = readTrimmed("TIKTOK_ADS_ACCESS_TOKEN");
  const advertiserRaw = readTrimmed("TIKTOK_ADVERTISER_ID");
  if (!accessToken || !advertiserRaw) return null;
  const defaults = getTikTokAdsEnvDefaults();
  return {
    accessToken,
    advertiserId: normalizeTikTokAdvertiserId(advertiserRaw),
    apiVersion: defaults.apiVersion,
    currencyFallback: defaults.currencyFallback,
  };
}

export function readTikTokAdsCredentials(
  settings: unknown,
  metadata: unknown,
): Omit<TikTokAdsCredentials, "source"> | null {
  const bags: Record<string, unknown>[] = [];
  if (settings && typeof settings === "object" && !Array.isArray(settings)) {
    bags.push(settings as Record<string, unknown>);
  }
  if (metadata && typeof metadata === "object" && !Array.isArray(metadata)) {
    bags.push(metadata as Record<string, unknown>);
  }

  let accessToken: string | null = null;
  let advertiserRaw: string | null = null;
  for (const bag of bags) {
    accessToken =
      accessToken ??
      readString(
        bag,
        "ads_access_token",
        "tiktok_ads_access_token",
        "marketing_access_token",
        "TIKTOK_ADS_ACCESS_TOKEN",
      );
    advertiserRaw =
      advertiserRaw ??
      readString(
        bag,
        "advertiser_id",
        "tiktok_advertiser_id",
        "ad_account_id",
        "ads_account_id",
        "TIKTOK_ADVERTISER_ID",
      );
  }

  if (!accessToken || !advertiserRaw) return null;
  const defaults = getTikTokAdsEnvDefaults();
  return {
    accessToken,
    advertiserId: normalizeTikTokAdvertiserId(advertiserRaw),
    apiVersion: defaults.apiVersion,
    currencyFallback: defaults.currencyFallback,
  };
}

export function resolveTikTokAdsCredentials(
  settings: unknown,
  metadata: unknown,
): TikTokAdsCredentials | null {
  const fromIntegration = readTikTokAdsCredentials(settings, metadata);
  if (fromIntegration) return { ...fromIntegration, source: "integration" };
  const fromEnv = readTikTokAdsCredentialsFromEnv();
  if (fromEnv) return { ...fromEnv, source: "env" };
  return null;
}
