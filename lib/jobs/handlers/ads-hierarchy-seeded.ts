import { z } from "zod";
import { PermanentJobError } from "@/lib/jobs/errors";
import type { JobHandler, JobHandlerResult } from "@/lib/jobs/types";
import { buildMockAdsSeed } from "@/lib/attribution/mock-ads";
import type { Json } from "@/types/database.generated";

export const adsHierarchySeededPayloadSchema = z.object({
  platform: z.enum(["meta", "tiktok"]).default("meta"),
  store_slug: z.string().min(1).max(80).optional(),
  demo_seed: z.string().min(1).max(200).optional(),
  day_offset: z.number().int().nonnegative().default(0),
});

function asObject(payload: Json): Record<string, unknown> {
  if (payload && typeof payload === "object" && !Array.isArray(payload)) {
    return payload as Record<string, unknown>;
  }
  throw new PermanentJobError("INVALID_PAYLOAD", "El payload de ads hierarchy no es válido.");
}

/**
 * Seeds ad_accounts → campaigns → ad_sets → ads → ad_spend_daily
 * plus sample attribution_touchpoints / order_attributions for recent orders.
 * Idempotent on demo_seed / external ids.
 */
export const handleAdsHierarchySeeded: JobHandler = async ({
  admin,
  job,
  payload,
}): Promise<JobHandlerResult> => {
  const parsed = adsHierarchySeededPayloadSchema.safeParse(asObject(payload));
  if (!parsed.success) {
    throw new PermanentJobError("INVALID_PAYLOAD", "Payload de ads.hierarchy.seeded.mock inválido.");
  }
  if (!job.store_id || !job.integration_id) {
    throw new PermanentJobError(
      "MISSING_CONTEXT",
      "ads.hierarchy.seeded.mock requiere store_id e integration_id.",
    );
  }

  const data = parsed.data;
  const seed = buildMockAdsSeed(data.store_slug ?? job.store_id.slice(0, 8), data.day_offset);
  const demoSeed = data.demo_seed ?? `ads-hierarchy:${job.store_id}:${seed.metricDate}`;

  // Account
  let accountId: string;
  const existingAccount = await admin
    .from("ad_accounts")
    .select("id")
    .eq("store_id", job.store_id)
    .eq("integration_id", job.integration_id)
    .eq("external_account_id", seed.externalAccountId)
    .maybeSingle();
  if (existingAccount.data) {
    accountId = existingAccount.data.id;
  } else {
    const created = await admin
      .from("ad_accounts")
      .insert({
        agency_id: job.agency_id,
        store_id: job.store_id,
        integration_id: job.integration_id,
        platform: seed.platform,
        external_account_id: seed.externalAccountId,
        name: `Mock ${seed.platform} ${seed.externalAccountId}`,
        currency_code: "PEN",
        metadata: { demo: true, demo_seed: demoSeed } as Json,
      })
      .select("id")
      .single();
    if (created.error || !created.data) {
      throw new PermanentJobError("DATABASE_ERROR", "No se pudo crear ad_account.");
    }
    accountId = created.data.id;
  }

  let campaignsCreated = 0;
  let spendRows = 0;

  for (const camp of seed.campaigns) {
    let campaignId: string;
    const existingCamp = await admin
      .from("ad_campaigns")
      .select("id")
      .eq("store_id", job.store_id)
      .eq("external_campaign_id", camp.externalId)
      .maybeSingle();
    if (existingCamp.data) {
      campaignId = existingCamp.data.id;
    } else {
      const created = await admin
        .from("ad_campaigns")
        .insert({
          agency_id: job.agency_id,
          store_id: job.store_id,
          ad_account_id: accountId,
          external_campaign_id: camp.externalId,
          name: camp.name,
          platform: seed.platform,
          status: "active",
          objective: camp.profitable ? "conversions" : "traffic",
          metadata: {
            demo: true,
            demo_seed: demoSeed,
            profitable: camp.profitable,
            high_rto: camp.highRto,
          } as Json,
        })
        .select("id")
        .single();
      if (created.error || !created.data) {
        throw new PermanentJobError("DATABASE_ERROR", "No se pudo crear campaña mock.");
      }
      campaignId = created.data.id;
      campaignsCreated += 1;
    }

    for (const adSet of camp.adSets) {
      let adSetId: string;
      const existingSet = await admin
        .from("ad_sets")
        .select("id")
        .eq("store_id", job.store_id)
        .eq("external_ad_set_id", adSet.externalId)
        .maybeSingle();
      if (existingSet.data) {
        adSetId = existingSet.data.id;
      } else {
        const created = await admin
          .from("ad_sets")
          .insert({
            agency_id: job.agency_id,
            store_id: job.store_id,
            campaign_id: campaignId,
            external_ad_set_id: adSet.externalId,
            name: adSet.name,
            platform: seed.platform,
            status: "active",
            targeting: { demo: true } as Json,
            metadata: { demo: true, demo_seed: demoSeed } as Json,
          })
          .select("id")
          .single();
        if (created.error || !created.data) {
          throw new PermanentJobError("DATABASE_ERROR", "No se pudo crear ad set mock.");
        }
        adSetId = created.data.id;
      }

      for (const ad of adSet.ads) {
        const existingAd = await admin
          .from("ads")
          .select("id")
          .eq("store_id", job.store_id)
          .eq("external_ad_id", ad.externalId)
          .maybeSingle();
        let adId = existingAd.data?.id;
        if (!adId) {
          const created = await admin
            .from("ads")
            .insert({
              agency_id: job.agency_id,
              store_id: job.store_id,
              campaign_id: campaignId,
              ad_set_id: adSetId,
              external_ad_id: ad.externalId,
              name: ad.name,
              platform: seed.platform,
              status: "active",
              metadata: { demo: true, demo_seed: demoSeed } as Json,
            })
            .select("id")
            .single();
          if (created.error || !created.data) {
            throw new PermanentJobError("DATABASE_ERROR", "No se pudo crear ad mock.");
          }
          adId = created.data.id;
        }

        // Daily spend at ad grain
        const spendDup = await admin
          .from("ad_spend_daily")
          .select("id")
          .eq("store_id", job.store_id)
          .eq("ad_id", adId)
          .eq("metric_date", seed.metricDate)
          .maybeSingle();
        if (!spendDup.data) {
          const perAdSpend = camp.spend / Math.max(1, adSet.ads.length);
          const perAdImp = Math.floor(camp.impressions / Math.max(1, adSet.ads.length));
          const perAdClicks = Math.floor(camp.clicks / Math.max(1, adSet.ads.length));
          await admin.from("ad_spend_daily").insert({
            agency_id: job.agency_id,
            store_id: job.store_id,
            ad_account_id: accountId,
            campaign_id: campaignId,
            ad_set_id: adSetId,
            ad_id: adId,
            platform: seed.platform,
            metric_date: seed.metricDate,
            spend: perAdSpend,
            impressions: perAdImp,
            clicks: perAdClicks,
            currency_code: "PEN",
            platform_conversions: camp.profitable ? 12 : 4,
            platform_conversion_value: camp.profitable ? 900 : 200,
            raw_metrics: { demo: true, demo_seed: demoSeed, job_id: job.id } as Json,
          });
          spendRows += 1;
        }
      }
    }
  }

  // Attribute recent orders: half to profitable campaign, some unattributed
  const campaigns = await admin
    .from("ad_campaigns")
    .select("id, metadata")
    .eq("store_id", job.store_id)
    .contains("metadata", { demo_seed: demoSeed });
  const profitCamp = (campaigns.data ?? []).find((c) => {
    const m = c.metadata as Record<string, unknown> | null;
    return m?.profitable === true;
  });
  const rtoCamp = (campaigns.data ?? []).find((c) => {
    const m = c.metadata as Record<string, unknown> | null;
    return m?.high_rto === true;
  });

  const orders = await admin
    .from("orders")
    .select("id, total_amount, order_status")
    .eq("store_id", job.store_id)
    .order("created_at", { ascending: false })
    .limit(20);

  let attributions = 0;
  for (let i = 0; i < (orders.data ?? []).length; i++) {
    const order = orders.data![i]!;
    const existingAttr = await admin
      .from("order_attributions")
      .select("id")
      .eq("order_id", order.id)
      .eq("is_primary", true)
      .maybeSingle();
    if (existingAttr.data) continue;

    // Every 5th order unattributed
    if (i % 5 === 4) {
      await admin.from("order_attributions").insert({
        agency_id: job.agency_id,
        store_id: job.store_id,
        order_id: order.id,
        model: "unattributed",
        platform: "other",
        credit: 0,
        attributed_value: 0,
        is_primary: true,
        attribution_reason: "demo_unattributed",
        metadata: { demo: true, demo_seed: demoSeed } as Json,
      });
      attributions += 1;
      continue;
    }

    const campId = i % 3 === 0 && rtoCamp ? rtoCamp.id : profitCamp?.id;
    if (!campId) continue;

    const tp = await admin
      .from("attribution_touchpoints")
      .insert({
        agency_id: job.agency_id,
        store_id: job.store_id,
        platform: seed.platform,
        campaign_id: campId,
        occurred_at: new Date().toISOString(),
        source: seed.platform,
        medium: "paid",
        campaign_name: campId.slice(0, 8),
        fbclid: seed.platform === "meta" ? `fbclid-${order.id.slice(0, 8)}` : null,
        ttclid: seed.platform === "tiktok" ? `ttclid-${order.id.slice(0, 8)}` : null,
        metadata: { demo: true, demo_seed: demoSeed } as Json,
      })
      .select("id")
      .single();

    await admin.from("order_attributions").insert({
      agency_id: job.agency_id,
      store_id: job.store_id,
      order_id: order.id,
      touchpoint_id: tp.data?.id ?? null,
      campaign_id: campId,
      model: "last_click",
      platform: seed.platform,
      credit: 1,
      attributed_value: order.total_amount,
      is_primary: true,
      confidence_score: 0.85,
      attribution_reason: "demo_last_click",
      metadata: { demo: true, demo_seed: demoSeed } as Json,
    });
    attributions += 1;
  }

  return {
    ok: true,
    action: "created",
    entityType: "ad_account",
    entityId: accountId,
    detail: `campaigns=${campaignsCreated};spend_rows=${spendRows};attributions=${attributions}`,
  };
};
