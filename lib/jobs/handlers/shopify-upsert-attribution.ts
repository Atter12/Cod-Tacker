import type { JobsAdminClient } from "@/lib/jobs/types";
import type { ShopifyMappedAttribution } from "@/lib/integrations/shopify/map-attribution";
import {
  resolveStoreCampaignFromUtm,
  type CampaignMatchResult,
} from "@/lib/attribution/match-campaign";
import type { Json } from "@/types/database.generated";

const SIN_ATRIBUCION = "Sin atribución";

function mergeCampaignMatchMeta(
  base: Record<string, unknown>,
  matched: CampaignMatchResult | null,
  utmCampaign: string | null,
): Record<string, unknown> {
  if (!matched) return base;
  return {
    ...base,
    campaign_match: {
      method: matched.method,
      utm_campaign: utmCampaign,
    },
  };
}

/**
 * Persist Shopify landing/UTM/click IDs onto the order and primary attribution rows.
 * - Always updates landing_site / referring_site + metadata.shopify_attribution when provided.
 * - With UTM/click IDs: touchpoint + primary utm_last_touch attribution.
 * - Resolves utm_campaign → ad_campaigns.id when Insights has seeded campaigns (step 2).
 * - Without signals: primary row model=unattributed, reason "Sin atribución".
 */
export async function upsertShopifyOrderAttribution(input: {
  admin: JobsAdminClient;
  agencyId: string;
  storeId: string;
  orderId: string;
  customerId?: string | null;
  attributedValue?: number;
  attribution: ShopifyMappedAttribution;
}): Promise<void> {
  const { admin, agencyId, storeId, orderId, attribution } = input;
  const now = new Date().toISOString();

  const existingOrder = await admin
    .from("orders")
    .select("id, metadata, landing_site, referring_site")
    .eq("id", orderId)
    .eq("store_id", storeId)
    .maybeSingle();
  if (existingOrder.error || !existingOrder.data) return;

  const prevMeta =
    existingOrder.data.metadata && typeof existingOrder.data.metadata === "object"
      ? (existingOrder.data.metadata as Record<string, unknown>)
      : {};

  const shopifyAttribution = {
    has_attribution: attribution.has_attribution,
    utm_source: attribution.utm_source,
    utm_medium: attribution.utm_medium,
    utm_campaign: attribution.utm_campaign,
    utm_term: attribution.utm_term,
    utm_content: attribution.utm_content,
    fbclid: attribution.fbclid,
    ttclid: attribution.ttclid,
    gclid: attribution.gclid,
    platform: attribution.platform,
  };

  await admin
    .from("orders")
    .update({
      landing_site: attribution.landing_site ?? existingOrder.data.landing_site,
      referring_site: attribution.referring_site ?? existingOrder.data.referring_site,
      metadata: {
        ...prevMeta,
        shopify_attribution: shopifyAttribution,
      } as Json,
    })
    .eq("id", orderId)
    .eq("store_id", storeId);

  const matched = await resolveStoreCampaignFromUtm({
    admin,
    storeId,
    utmCampaign: attribution.utm_campaign,
    platform: attribution.platform,
  });
  const campaignId = matched?.campaignId ?? null;

  const existingPrimary = await admin
    .from("order_attributions")
    .select("id, model, campaign_id, touchpoint_id, metadata")
    .eq("order_id", orderId)
    .eq("store_id", storeId)
    .eq("is_primary", true)
    .maybeSingle();

  if (!attribution.has_attribution) {
    if (!existingPrimary.data) {
      await admin.from("order_attributions").insert({
        agency_id: agencyId,
        store_id: storeId,
        order_id: orderId,
        model: "unattributed",
        platform: "other",
        credit: 0,
        attributed_value: 0,
        is_primary: true,
        attribution_reason: SIN_ATRIBUCION,
        metadata: {
          provider: "shopify",
          shopify_attribution: shopifyAttribution,
        } as Json,
      });
    }
    return;
  }

  // Upgrade placeholder unattributed → real Shopify attribution when UTMs arrive later.
  if (existingPrimary.data) {
    if (existingPrimary.data.model === "unattributed") {
      await admin.from("order_attributions").delete().eq("id", existingPrimary.data.id);
    } else {
      // Backfill campaign_id once ad_campaigns exist (e.g. after Insights sync).
      if (!existingPrimary.data.campaign_id && campaignId && matched) {
        const rowMeta =
          existingPrimary.data.metadata &&
          typeof existingPrimary.data.metadata === "object" &&
          !Array.isArray(existingPrimary.data.metadata)
            ? (existingPrimary.data.metadata as Record<string, unknown>)
            : {};
        await admin
          .from("order_attributions")
          .update({
            campaign_id: campaignId,
            metadata: mergeCampaignMatchMeta(
              {
                ...rowMeta,
                provider: "shopify",
                shopify_attribution: shopifyAttribution,
              },
              matched,
              attribution.utm_campaign,
            ) as Json,
          })
          .eq("id", existingPrimary.data.id);

        if (existingPrimary.data.touchpoint_id) {
          await admin
            .from("attribution_touchpoints")
            .update({ campaign_id: campaignId })
            .eq("id", existingPrimary.data.touchpoint_id)
            .is("campaign_id", null);
        }
      }
      return;
    }
  }

  const touchpoint = await admin
    .from("attribution_touchpoints")
    .insert({
      agency_id: agencyId,
      store_id: storeId,
      customer_id: input.customerId ?? null,
      platform: attribution.platform,
      occurred_at: now,
      landing_url: attribution.landing_site,
      referrer_url: attribution.referring_site,
      source: attribution.utm_source,
      medium: attribution.utm_medium,
      campaign_name: attribution.utm_campaign,
      campaign_id: campaignId,
      term: attribution.utm_term,
      content: attribution.utm_content,
      fbclid: attribution.fbclid,
      ttclid: attribution.ttclid,
      click_id: attribution.fbclid ?? attribution.ttclid ?? attribution.gclid,
      metadata: {
        provider: "shopify",
        gclid: attribution.gclid,
        ...(matched
          ? {
              campaign_match: {
                method: matched.method,
                utm_campaign: attribution.utm_campaign,
              },
            }
          : {}),
      } as Json,
    })
    .select("id")
    .single();

  const reasonParts = [
    attribution.utm_source ? `utm_source=${attribution.utm_source}` : null,
    attribution.utm_campaign ? `utm_campaign=${attribution.utm_campaign}` : null,
    attribution.fbclid ? "fbclid" : null,
    attribution.ttclid ? "ttclid" : null,
    attribution.gclid ? "gclid" : null,
    matched ? `campaign_match=${matched.method}` : null,
  ].filter(Boolean);

  await admin.from("order_attributions").insert({
    agency_id: agencyId,
    store_id: storeId,
    order_id: orderId,
    touchpoint_id: touchpoint.data?.id ?? null,
    campaign_id: campaignId,
    model: "utm_last_touch",
    platform: attribution.platform,
    credit: 1,
    attributed_value: input.attributedValue ?? 0,
    is_primary: true,
    confidence_score: matched ? 0.85 : 0.7,
    attribution_reason: reasonParts.length
      ? `shopify_landing:${reasonParts.join(",")}`
      : "shopify_landing",
    metadata: mergeCampaignMatchMeta(
      {
        provider: "shopify",
        shopify_attribution: shopifyAttribution,
      },
      matched,
      attribution.utm_campaign,
    ) as Json,
  });
}
