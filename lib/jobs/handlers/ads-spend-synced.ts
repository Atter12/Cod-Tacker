import { z } from "zod";
import { PermanentJobError } from "@/lib/jobs/errors";
import type { JobHandler, JobHandlerResult } from "@/lib/jobs/types";
import type { Json } from "@/types/database.generated";

export const adsSpendSyncedPayloadSchema = z.object({
  platform: z.enum(["meta", "tiktok"]),
  external_account_id: z.string().min(1).max(200),
  metric_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  spend: z.number().nonnegative(),
  currency_code: z.string().length(3).default("PEN"),
  impressions: z.number().int().nonnegative().default(0),
  clicks: z.number().int().nonnegative().default(0),
  demo_seed: z.string().min(1).max(200).optional(),
});

function asObject(payload: Json): Record<string, unknown> {
  if (payload && typeof payload === "object" && !Array.isArray(payload)) {
    return payload as Record<string, unknown>;
  }
  throw new PermanentJobError("INVALID_PAYLOAD", "El payload de ads no es un objeto válido.");
}

export const handleAdsSpendSynced: JobHandler = async ({
  admin,
  job,
  payload,
}): Promise<JobHandlerResult> => {
  const parsed = adsSpendSyncedPayloadSchema.safeParse(asObject(payload));
  if (!parsed.success) {
    throw new PermanentJobError("INVALID_PAYLOAD", "Payload de ads.spend.synced.mock inválido.");
  }
  if (!job.integration_id) {
    throw new PermanentJobError("MISSING_INTEGRATION", "El trabajo de ads requiere integration_id.");
  }

  const data = parsed.data;

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
        name: `Mock ${data.platform} ${data.external_account_id}`,
        currency_code: data.currency_code,
        metadata: { demo: true, demo_seed: data.demo_seed ?? null } as Json,
      })
      .select("id")
      .single();
    if (created.error || !created.data) {
      throw new PermanentJobError("DATABASE_ERROR", "No se pudo crear la cuenta de anuncios mock.");
    }
    adAccountId = created.data.id;
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

  const sameDay = await admin
    .from("ad_spend_daily")
    .select("id")
    .eq("ad_account_id", adAccountId)
    .eq("metric_date", data.metric_date)
    .eq("platform", data.platform)
    .maybeSingle();
  if (sameDay.data) {
    const updated = await admin
      .from("ad_spend_daily")
      .update({
        spend: data.spend,
        impressions: data.impressions,
        clicks: data.clicks,
        currency_code: data.currency_code,
        raw_metrics: {
          demo: true,
          demo_seed: data.demo_seed ?? null,
          job_id: job.id,
        } as Json,
      })
      .eq("id", sameDay.data.id)
      .select("id")
      .single();
    if (updated.error || !updated.data) {
      throw new PermanentJobError("DATABASE_ERROR", "No se pudo actualizar el gasto diario mock.");
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
      platform: data.platform,
      metric_date: data.metric_date,
      spend: data.spend,
      impressions: data.impressions,
      clicks: data.clicks,
      currency_code: data.currency_code,
      raw_metrics: {
        demo: true,
        demo_seed: data.demo_seed ?? null,
        job_id: job.id,
      } as Json,
    })
    .select("id")
    .single();
  if (insert.error || !insert.data) {
    throw new PermanentJobError("DATABASE_ERROR", "No se pudo insertar el gasto diario mock.");
  }

  return {
    ok: true,
    action: "created",
    entityType: "ad_spend_daily",
    entityId: insert.data.id,
  };
};
