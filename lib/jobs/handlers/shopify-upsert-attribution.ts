import type { JobsAdminClient } from "@/lib/jobs/types";
import type { ShopifyMappedAttribution } from "@/lib/integrations/shopify/map-attribution";
import type { Json } from "@/types/database.generated";

const SIN_ATRIBUCION = "Sin atribución";

/**
 * Persist Shopify landing/UTM/click IDs onto the order and primary attribution rows.
 * - Always updates landing_site / referring_site + metadata.shopify_attribution when provided.
 * - With UTM/click IDs: touchpoint + primary utm_last_touch attribution.
 * - Without signals (empty note / no landing UTMs): primary row model=unattributed, reason "Sin atribución".
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

  const existingPrimary = await admin
    .from("order_attributions")
    .select("id, model")
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
    if (existingPrimary.data.model !== "unattributed") {
      return;
    }
    await admin.from("order_attributions").delete().eq("id", existingPrimary.data.id);
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
      term: attribution.utm_term,
      content: attribution.utm_content,
      fbclid: attribution.fbclid,
      ttclid: attribution.ttclid,
      click_id: attribution.fbclid ?? attribution.ttclid ?? attribution.gclid,
      metadata: {
        provider: "shopify",
        gclid: attribution.gclid,
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
  ].filter(Boolean);

  await admin.from("order_attributions").insert({
    agency_id: agencyId,
    store_id: storeId,
    order_id: orderId,
    touchpoint_id: touchpoint.data?.id ?? null,
    model: "utm_last_touch",
    platform: attribution.platform,
    credit: 1,
    attributed_value: input.attributedValue ?? 0,
    is_primary: true,
    confidence_score: 0.7,
    attribution_reason: reasonParts.length
      ? `shopify_landing:${reasonParts.join(",")}`
      : "shopify_landing",
    metadata: {
      provider: "shopify",
      shopify_attribution: shopifyAttribution,
    } as Json,
  });
}
