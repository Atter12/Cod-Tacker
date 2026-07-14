import type { Database } from "@/types/database.generated";

export type ShopifyAdPlatform = Database["public"]["Enums"]["ad_platform"];

export type ShopifyMappedAttribution = {
  landing_site: string | null;
  referring_site: string | null;
  /** True when UTM params and/or click IDs are present. */
  has_attribution: boolean;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  utm_term: string | null;
  utm_content: string | null;
  fbclid: string | null;
  ttclid: string | null;
  gclid: string | null;
  platform: ShopifyAdPlatform;
};

export type ShopifyRestNoteAttribute = {
  name?: string | null;
  value?: string | null;
};

const UTM_KEYS = [
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_term",
  "utm_content",
  "fbclid",
  "ttclid",
  "gclid",
] as const;

type AttributionKey = (typeof UTM_KEYS)[number];

function trimOrNull(value: string | null | undefined): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed.slice(0, 2000) : null;
}

function setIfEmpty(
  bag: Partial<Record<AttributionKey, string>>,
  key: AttributionKey,
  value: string | null | undefined,
): void {
  const next = trimOrNull(value);
  if (!next || bag[key]) return;
  bag[key] = next.slice(0, 500);
}

/** Parse query string from a full URL or a path+query landing_site. */
export function parseAttributionFromUrl(raw: string | null | undefined): Partial<Record<AttributionKey, string>> {
  const text = trimOrNull(raw);
  if (!text) return {};

  let search = "";
  try {
    if (/^https?:\/\//i.test(text)) {
      search = new URL(text).search;
    } else {
      const q = text.includes("?") ? text.slice(text.indexOf("?")) : "";
      search = q;
    }
  } catch {
    const idx = text.indexOf("?");
    search = idx >= 0 ? text.slice(idx) : "";
  }

  if (!search || search === "?") return {};

  const params = new URLSearchParams(search.startsWith("?") ? search : `?${search}`);
  const out: Partial<Record<AttributionKey, string>> = {};
  for (const key of UTM_KEYS) {
    setIfEmpty(out, key, params.get(key));
  }
  return out;
}

function parseNoteAttributes(
  attrs: ShopifyRestNoteAttribute[] | null | undefined,
): Partial<Record<AttributionKey, string>> {
  if (!Array.isArray(attrs)) return {};
  const out: Partial<Record<AttributionKey, string>> = {};
  for (const row of attrs) {
    const name = trimOrNull(row.name)?.toLowerCase();
    if (!name) continue;
    const key = UTM_KEYS.find((k) => k === name || name.endsWith(k));
    if (!key) continue;
    setIfEmpty(out, key, row.value);
  }
  return out;
}

/** Pull a URL-looking fragment from free-text order note. */
function parseNoteText(note: string | null | undefined): Partial<Record<AttributionKey, string>> {
  const text = trimOrNull(note);
  if (!text) return {};
  const urlMatch = text.match(/https?:\/\/[^\s]+/i);
  if (urlMatch?.[0]) return parseAttributionFromUrl(urlMatch[0]);
  if (text.includes("utm_") || text.includes("fbclid") || text.includes("ttclid")) {
    return parseAttributionFromUrl(`https://local.invalid/?${text.replace(/\s+/g, "&")}`);
  }
  return {};
}

export function inferShopifyAttributionPlatform(input: {
  fbclid?: string | null;
  ttclid?: string | null;
  gclid?: string | null;
  utm_source?: string | null;
}): ShopifyAdPlatform {
  if (input.fbclid) return "meta";
  if (input.ttclid) return "tiktok";
  if (input.gclid) return "google";
  const source = (input.utm_source ?? "").toLowerCase();
  if (!source) return "other";
  if (/(facebook|fb|meta|instagram|ig)/.test(source)) return "meta";
  if (/(tiktok|tt)/.test(source)) return "tiktok";
  if (/(google|gads|adwords)/.test(source)) return "google";
  if (/(organic|seo)/.test(source)) return "organic";
  if (/(direct)/.test(source)) return "direct";
  return "other";
}

/**
 * Merge Shopify Order landing/referrer + query params + note_attributes into one attribution payload.
 */
export function mapRestOrderAttribution(input: {
  landing_site?: string | null;
  referring_site?: string | null;
  note?: string | null;
  note_attributes?: ShopifyRestNoteAttribute[] | null;
}): ShopifyMappedAttribution {
  const landing_site = trimOrNull(input.landing_site);
  const referring_site = trimOrNull(input.referring_site);

  const merged: Partial<Record<AttributionKey, string>> = {};
  for (const part of [
    parseAttributionFromUrl(landing_site),
    parseAttributionFromUrl(referring_site),
    parseNoteAttributes(input.note_attributes),
    parseNoteText(input.note),
  ]) {
    for (const key of UTM_KEYS) {
      setIfEmpty(merged, key, part[key]);
    }
  }

  const utm_source = merged.utm_source ?? null;
  const utm_medium = merged.utm_medium ?? null;
  const utm_campaign = merged.utm_campaign ?? null;
  const utm_term = merged.utm_term ?? null;
  const utm_content = merged.utm_content ?? null;
  const fbclid = merged.fbclid ?? null;
  const ttclid = merged.ttclid ?? null;
  const gclid = merged.gclid ?? null;

  const has_attribution = Boolean(
    utm_source ||
      utm_medium ||
      utm_campaign ||
      utm_term ||
      utm_content ||
      fbclid ||
      ttclid ||
      gclid,
  );

  return {
    landing_site,
    referring_site,
    has_attribution,
    utm_source,
    utm_medium,
    utm_campaign,
    utm_term,
    utm_content,
    fbclid,
    ttclid,
    gclid,
    platform: inferShopifyAttributionPlatform({ fbclid, ttclid, gclid, utm_source }),
  };
}

export type ShopifyGraphqlCustomerVisit = {
  landingPage?: string | null;
  referrerUrl?: string | null;
  utmParameters?: {
    source?: string | null;
    medium?: string | null;
    campaign?: string | null;
    content?: string | null;
    term?: string | null;
  } | null;
};

export function mapGraphqlOrderAttribution(input: {
  lastVisit?: ShopifyGraphqlCustomerVisit | null;
  firstVisit?: ShopifyGraphqlCustomerVisit | null;
}): ShopifyMappedAttribution {
  const visit = input.lastVisit ?? input.firstVisit ?? null;
  const landing = trimOrNull(visit?.landingPage);
  const referring = trimOrNull(visit?.referrerUrl);
  const utm = visit?.utmParameters;

  return mapRestOrderAttribution({
    landing_site: landing,
    referring_site: referring,
    note_attributes: [
      { name: "utm_source", value: utm?.source },
      { name: "utm_medium", value: utm?.medium },
      { name: "utm_campaign", value: utm?.campaign },
      { name: "utm_content", value: utm?.content },
      { name: "utm_term", value: utm?.term },
    ],
  });
}
