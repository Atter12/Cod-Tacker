import { parseStoreSettings } from "@/lib/settings/store-settings";
import type { JobsAdminClient } from "@/lib/jobs/types";
import type { Json } from "@/types/database.generated";

export type CampaignMatchCandidate = {
  id: string;
  external_campaign_id: string;
  name: string;
  platform: string;
};

export type UtmCampaignAlias = {
  utm: string;
  campaignId: string;
};

export type CampaignMatchMethod =
  | "alias"
  | "external_id"
  | "name_exact"
  | "name_normalized";

export type CampaignMatchResult = {
  campaignId: string;
  method: CampaignMatchMethod;
};

/** Normalize campaign labels so "Verano COD" ↔ "verano_cod" can match. */
export function normalizeCampaignKey(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

/** Manual store aliases win over auto name/id matching. */
export function matchUtmCampaignAlias(
  utmCampaign: string,
  aliases: UtmCampaignAlias[],
): CampaignMatchResult | null {
  const needle = utmCampaign.trim();
  if (!needle || aliases.length === 0) return null;
  const needleNorm = normalizeCampaignKey(needle);
  const hit = aliases.find((a) => {
    const alias = a.utm.trim();
    if (!alias) return false;
    return alias === needle || normalizeCampaignKey(alias) === needleNorm;
  });
  if (!hit) return null;
  return { campaignId: hit.campaignId, method: "alias" };
}

/**
 * Match utm_campaign text to an ad_campaigns row.
 * Priority: alias → external_campaign_id → exact name → normalized name.
 * Never guesses from fbclid/ttclid.
 */
export function matchUtmCampaignToAdCampaign(
  utmCampaign: string,
  candidates: CampaignMatchCandidate[],
  preferredPlatform?: string | null,
  aliases: UtmCampaignAlias[] = [],
): CampaignMatchResult | null {
  const needle = utmCampaign.trim();
  if (!needle) return null;

  const aliasHit = matchUtmCampaignAlias(needle, aliases);
  if (aliasHit) {
    const exists = candidates.some((c) => c.id === aliasHit.campaignId);
    if (exists || candidates.length === 0) return aliasHit;
    // Alias points at a campaign not in this candidate set — still valid if caller verified.
    return aliasHit;
  }

  if (candidates.length === 0) return null;

  const preferred =
    preferredPlatform === "meta" || preferredPlatform === "tiktok" ? preferredPlatform : null;
  const scoped = preferred ? candidates.filter((c) => c.platform === preferred) : candidates;
  const pool = scoped.length > 0 ? scoped : candidates;

  const byExt = pool.find((c) => c.external_campaign_id === needle);
  if (byExt) return { campaignId: byExt.id, method: "external_id" };

  const needleLower = needle.toLowerCase();
  const byExtCi = pool.find((c) => c.external_campaign_id.toLowerCase() === needleLower);
  if (byExtCi) return { campaignId: byExtCi.id, method: "external_id" };

  const byName = pool.find((c) => c.name.trim().toLowerCase() === needleLower);
  if (byName) return { campaignId: byName.id, method: "name_exact" };

  const needleNorm = normalizeCampaignKey(needle);
  if (!needleNorm) return null;

  const byNorm = pool.filter((c) => normalizeCampaignKey(c.name) === needleNorm);
  if (byNorm.length === 1) {
    return { campaignId: byNorm[0]!.id, method: "name_normalized" };
  }
  // Ambiguous: do not guess.
  return null;
}

async function loadStoreUtmAliases(
  admin: JobsAdminClient,
  storeId: string,
): Promise<UtmCampaignAlias[]> {
  const store = await admin.from("stores").select("settings").eq("id", storeId).maybeSingle();
  if (store.error || !store.data) return [];
  return parseStoreSettings(store.data.settings).attribution.utmCampaignAliases;
}

export async function resolveStoreCampaignFromUtm(input: {
  admin: JobsAdminClient;
  storeId: string;
  utmCampaign: string | null | undefined;
  platform?: string | null;
}): Promise<CampaignMatchResult | null> {
  const utm = (input.utmCampaign ?? "").trim();
  if (!utm) return null;

  const aliases = await loadStoreUtmAliases(input.admin, input.storeId);
  const aliasHit = matchUtmCampaignAlias(utm, aliases);
  if (aliasHit) {
    const owned = await input.admin
      .from("ad_campaigns")
      .select("id")
      .eq("id", aliasHit.campaignId)
      .eq("store_id", input.storeId)
      .maybeSingle();
    if (owned.data) return aliasHit;
  }

  const { data, error } = await input.admin
    .from("ad_campaigns")
    .select("id, external_campaign_id, name, platform")
    .eq("store_id", input.storeId)
    .limit(1000);
  if (error || !data?.length) return null;

  return matchUtmCampaignToAdCampaign(utm, data, input.platform, aliases);
}

function utmCampaignFromAttributionMetadata(metadata: Json | null | undefined): string | null {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return null;
  const shopify = (metadata as Record<string, unknown>).shopify_attribution;
  if (!shopify || typeof shopify !== "object" || Array.isArray(shopify)) return null;
  const utm = (shopify as Record<string, unknown>).utm_campaign;
  return typeof utm === "string" && utm.trim() ? utm.trim() : null;
}

async function applyCampaignToAttributionRow(input: {
  admin: JobsAdminClient;
  row: { id: string; touchpoint_id: string | null; metadata: Json | null };
  campaignId: string;
  method: CampaignMatchMethod;
  utm: string;
  linkedFrom: string;
}): Promise<boolean> {
  const prevMeta =
    input.row.metadata && typeof input.row.metadata === "object" && !Array.isArray(input.row.metadata)
      ? (input.row.metadata as Record<string, unknown>)
      : {};
  const updated = await input.admin
    .from("order_attributions")
    .update({
      campaign_id: input.campaignId,
      metadata: {
        ...prevMeta,
        campaign_match: {
          method: input.method,
          utm_campaign: input.utm,
          linked_from: input.linkedFrom,
        },
      } as Json,
    })
    .eq("id", input.row.id)
    .is("campaign_id", null);
  if (updated.error) return false;

  if (input.row.touchpoint_id) {
    await input.admin
      .from("attribution_touchpoints")
      .update({ campaign_id: input.campaignId })
      .eq("id", input.row.touchpoint_id)
      .is("campaign_id", null);
  }
  return true;
}

/**
 * After a live campaign appears (Insights sync), attach pending utm_last_touch
 * attributions whose utm_campaign matches this campaign (auto or alias).
 */
export async function linkStoreAttributionsToCampaign(input: {
  admin: JobsAdminClient;
  storeId: string;
  campaignId: string;
  externalCampaignId: string;
  campaignName: string;
  platform?: string | null;
}): Promise<number> {
  const pending = await input.admin
    .from("order_attributions")
    .select("id, touchpoint_id, metadata, platform")
    .eq("store_id", input.storeId)
    .eq("model", "utm_last_touch")
    .is("campaign_id", null)
    .limit(500);
  if (pending.error || !pending.data?.length) return 0;

  const aliases = await loadStoreUtmAliases(input.admin, input.storeId);
  const candidate: CampaignMatchCandidate = {
    id: input.campaignId,
    external_campaign_id: input.externalCampaignId,
    name: input.campaignName,
    platform: input.platform ?? "other",
  };

  let linked = 0;
  for (const row of pending.data) {
    const utm = utmCampaignFromAttributionMetadata(row.metadata);
    if (!utm) continue;
    const preferred = row.platform ?? input.platform;
    const matched = matchUtmCampaignToAdCampaign(utm, [candidate], preferred, aliases);
    if (!matched || matched.campaignId !== input.campaignId) continue;

    const ok = await applyCampaignToAttributionRow({
      admin: input.admin,
      row,
      campaignId: input.campaignId,
      method: matched.method,
      utm,
      linkedFrom: "ads_spend_sync",
    });
    if (ok) linked += 1;
  }

  return linked;
}

/** Re-link pending attributions after the merchant saves UTM aliases in settings. */
export async function applyStoreUtmAliasesToPendingAttributions(input: {
  admin: JobsAdminClient;
  storeId: string;
  aliases: UtmCampaignAlias[];
}): Promise<number> {
  if (input.aliases.length === 0) return 0;

  const pending = await input.admin
    .from("order_attributions")
    .select("id, touchpoint_id, metadata")
    .eq("store_id", input.storeId)
    .eq("model", "utm_last_touch")
    .is("campaign_id", null)
    .limit(500);
  if (pending.error || !pending.data?.length) return 0;

  const campaignIds = [...new Set(input.aliases.map((a) => a.campaignId))];
  const owned = await input.admin
    .from("ad_campaigns")
    .select("id")
    .eq("store_id", input.storeId)
    .in("id", campaignIds);
  const ownedIds = new Set((owned.data ?? []).map((c) => c.id));

  let linked = 0;
  for (const row of pending.data) {
    const utm = utmCampaignFromAttributionMetadata(row.metadata);
    if (!utm) continue;
    const matched = matchUtmCampaignAlias(utm, input.aliases);
    if (!matched || !ownedIds.has(matched.campaignId)) continue;

    const ok = await applyCampaignToAttributionRow({
      admin: input.admin,
      row,
      campaignId: matched.campaignId,
      method: "alias",
      utm,
      linkedFrom: "utm_alias_settings",
    });
    if (ok) linked += 1;
  }

  return linked;
}
