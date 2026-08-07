import { z } from "zod";
import { linkStoreAttributionsToCampaign } from "@/lib/attribution/match-campaign";
import { PermanentJobError } from "@/lib/jobs/errors";
import type { JobHandler, JobHandlerResult, JobsAdminClient } from "@/lib/jobs/types";
import type { Json } from "@/types/database.generated";

export const adsSpendSyncedPayloadSchema = z.object({
  platform: z.enum(["meta", "tiktok"]),
  external_account_id: z.string().min(1).max(200),
  /** When set, spend is stored at campaign grain and ad_campaigns is upserted. */
  external_campaign_id: z.string().min(1).max(200).optional(),
  campaign_name: z.string().min(1).max(500).optional(),
  metric_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  spend: z.number().nonnegative(),
  currency_code: z.string().length(3).default("PEN"),
  impressions: z.number().int().nonnegative().default(0),
  clicks: z.number().int().nonnegative().default(0),
  demo_seed: z.string().min(1).max(200).optional(),
  /** live = Meta/TikTok Insights; mock = demo seed path. */
  mode: z.enum(["live", "mock"]).optional(),
});

/** Persist which Insights/report API produced the row (not the ad platform column alone). */
export function adsSpendRawMetricsSource(
  platform: "meta" | "tiktok",
  isLive: boolean,
): "meta_insights" | "tiktok_insights" | "mock_sync" {
  if (!isLive) return "mock_sync";
  return platform === "tiktok" ? "tiktok_insights" : "meta_insights";
}

function asObject(payload: Json): Record<string, unknown> {
  if (payload && typeof payload === "object" && !Array.isArray(payload)) {
    return payload as Record<string, unknown>;
  }
  throw new PermanentJobError("INVALID_PAYLOAD", "El payload de ads no es un objeto válido.");
}

/**
 * Drop legacy account-level spend rows for the same account/day so store ROAS
 * (which sums all ad_spend_daily) does not double-count after campaign sync.
 */
async function clearLegacyAccountSpend(input: {
  admin: JobsAdminClient;
  adAccountId: string;
  metricDate: string;
  platform: "meta" | "tiktok";
}): Promise<void> {
  const legacy = await input.admin
    .from("ad_spend_daily")
    .delete()
    .eq("ad_account_id", input.adAccountId)
    .eq("metric_date", input.metricDate)
    .eq("platform", input.platform)
    .is("campaign_id", null);
  if (legacy.error) {
    throw new PermanentJobError(
      "DATABASE_ERROR",
      "No se pudo limpiar el gasto a nivel cuenta legado.",
    );
  }
}

export const handleAdsSpendSynced: JobHandler = async ({
  admin,
  job,
  payload,
}): Promise<JobHandlerResult> => {
  const parsed = adsSpendSyncedPayloadSchema.safeParse(asObject(payload));
  if (!parsed.success) {
    throw new PermanentJobError("INVALID_PAYLOAD", "Payload de ads.spend.synced inválido.");
  }
  if (!job.integration_id) {
    throw new PermanentJobError("MISSING_INTEGRATION", "El trabajo de ads requiere integration_id.");
  }

  const data = parsed.data;
  const isLive = data.mode === "live" || (!data.demo_seed && job.job_type === "ads.spend.synced");
  const externalCampaignId = data.external_campaign_id?.trim() || null;
  const campaignName =
    data.campaign_name?.trim() ||
    (externalCampaignId ? `Campaign ${externalCampaignId}` : null);

  let accountQuery = admin
    .from("ad_accounts")
    .select("id")
    .eq("agency_id", job.agency_id)
    .eq("integration_id", job.integration_id)
    .eq("external_account_id", data.external_account_id);
  if (job.store_id) accountQuery = accountQuery.eq("store_id", job.store_id);
  const existingAccount = await accountQuery.maybeSingle();
  if (existingAccount.error) {
    throw new PermanentJobError("DATABASE_ERROR", "No se pudo consultar la cuenta de anuncios.");
  }

  let adAccountId = existingAccount.data?.id;
  if (!adAccountId) {
    const created = await admin
      .from("ad_accounts")
      .insert({
        agency_id: job.agency_id,
        store_id: job.store_id,
        integration_id: job.integration_id,
        platform: data.platform,
        external_account_id: data.external_account_id,
        name: isLive
          ? `${data.platform} ${data.external_account_id}`
          : `Mock ${data.platform} ${data.external_account_id}`,
        currency_code: data.currency_code,
        metadata: {
          demo: !isLive,
          mode: isLive ? "live" : "mock",
          demo_seed: data.demo_seed ?? null,
        } as Json,
      })
      .select("id")
      .single();
    if (created.error || !created.data) {
      throw new PermanentJobError("DATABASE_ERROR", "No se pudo crear la cuenta de anuncios.");
    }
    adAccountId = created.data.id;
  }

  let campaignId: string | null = null;
  if (externalCampaignId) {
    const existingCamp = await admin
      .from("ad_campaigns")
      .select("id, name")
      .eq("ad_account_id", adAccountId)
      .eq("external_campaign_id", externalCampaignId)
      .maybeSingle();
    if (existingCamp.error) {
      throw new PermanentJobError("DATABASE_ERROR", "No se pudo consultar la campaña de anuncios.");
    }

    if (existingCamp.data) {
      campaignId = existingCamp.data.id;
      if (campaignName && existingCamp.data.name !== campaignName) {
        const renamed = await admin
          .from("ad_campaigns")
          .update({ name: campaignName })
          .eq("id", campaignId);
        if (renamed.error) {
          throw new PermanentJobError("DATABASE_ERROR", "No se pudo actualizar el nombre de campaña.");
        }
      }
    } else {
      const createdCamp = await admin
        .from("ad_campaigns")
        .insert({
          agency_id: job.agency_id,
          store_id: job.store_id,
          ad_account_id: adAccountId,
          external_campaign_id: externalCampaignId,
          name: campaignName ?? `Campaign ${externalCampaignId}`,
          platform: data.platform,
          status: "active",
          metadata: {
            demo: !isLive,
            mode: isLive ? "live" : "mock",
            source: adsSpendRawMetricsSource(data.platform, isLive),
          } as Json,
        })
        .select("id")
        .single();
      if (createdCamp.error || !createdCamp.data) {
        throw new PermanentJobError("DATABASE_ERROR", "No se pudo crear la campaña de anuncios.");
      }
      campaignId = createdCamp.data.id;
    }

    if (isLive) {
      await clearLegacyAccountSpend({
        admin,
        adAccountId,
        metricDate: data.metric_date,
        platform: data.platform,
      });
    }

    // Step 2 reverse link: pending orders with matching utm_campaign → this campaign.
    if (isLive && campaignId && job.store_id) {
      await linkStoreAttributionsToCampaign({
        admin,
        storeId: job.store_id,
        campaignId,
        externalCampaignId,
        campaignName: campaignName ?? `Campaign ${externalCampaignId}`,
        platform: data.platform,
      });
    }
  }

  if (data.demo_seed) {
    const dup = await admin
      .from("ad_spend_daily")
      .select("id")
      .eq("ad_account_id", adAccountId)
      .eq("metric_date", data.metric_date)
      .contains("raw_metrics", { demo_seed: data.demo_seed })
      .maybeSingle();
    if (dup.data) {
      return {
        ok: true,
        action: "skipped",
        entityType: "ad_spend_daily",
        entityId: dup.data.id,
        detail: "duplicate_demo_seed",
      };
    }
  }

  const rawMetrics = {
    demo: !isLive,
    mode: isLive ? "live" : "mock",
    demo_seed: data.demo_seed ?? null,
    job_id: job.id,
    source: adsSpendRawMetricsSource(data.platform, isLive),
    grain: campaignId ? "campaign" : "account",
    external_campaign_id: externalCampaignId,
  } as Json;

  let sameDayQuery = admin
    .from("ad_spend_daily")
    .select("id")
    .eq("ad_account_id", adAccountId)
    .eq("metric_date", data.metric_date)
    .eq("platform", data.platform);
  sameDayQuery = campaignId
    ? sameDayQuery.eq("campaign_id", campaignId)
    : sameDayQuery.is("campaign_id", null);
  const sameDay = await sameDayQuery.maybeSingle();
  if (sameDay.data) {
    const updated = await admin
      .from("ad_spend_daily")
      .update({
        spend: data.spend,
        impressions: data.impressions,
        clicks: data.clicks,
        currency_code: data.currency_code,
        campaign_id: campaignId,
        raw_metrics: rawMetrics,
      })
      .eq("id", sameDay.data.id)
      .select("id")
      .single();
    if (updated.error || !updated.data) {
      throw new PermanentJobError("DATABASE_ERROR", "No se pudo actualizar el gasto diario.");
    }
    return {
      ok: true,
      action: "updated",
      entityType: "ad_spend_daily",
      entityId: updated.data.id,
    };
  }

  const insert = await admin
    .from("ad_spend_daily")
    .insert({
      agency_id: job.agency_id,
      store_id: job.store_id,
      ad_account_id: adAccountId,
      campaign_id: campaignId,
      platform: data.platform,
      metric_date: data.metric_date,
      spend: data.spend,
      impressions: data.impressions,
      clicks: data.clicks,
      currency_code: data.currency_code,
      raw_metrics: rawMetrics,
    })
    .select("id")
    .single();
  if (insert.error || !insert.data) {
    throw new PermanentJobError("DATABASE_ERROR", "No se pudo insertar el gasto diario.");
  }

  return {
    ok: true,
    action: "created",
    entityType: "ad_spend_daily",
    entityId: insert.data.id,
  };
};
