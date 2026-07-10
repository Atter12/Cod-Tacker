import type { AdCampaignRow, AdSpendDailyRow } from "@/types/database";
import { requireValue, throwQueryError, type DatabaseClient } from "./_shared";

export type CampaignPerformance = {
  campaign: AdCampaignRow
  spend: number
  impressions: number
  clicks: number
  platformConversions: number
  platformConversionValue: number
};

/** Services receive the request-scoped typed client so RLS remains enforced and callers can test queries. */
export async function listCampaigns(client: DatabaseClient, storeId: string, dateRange?: { from: string; to: string }): Promise<CampaignPerformance[]> {
  const id = requireValue(storeId, "Tienda inválida.");
  const [campaignsResult, spendResult] = await Promise.all([
    client.from("ad_campaigns").select().eq("store_id", id).order("name"),
    dateRange
      ? client.from("ad_spend_daily").select().eq("store_id", id).gte("metric_date", dateRange.from).lte("metric_date", dateRange.to)
      : client.from("ad_spend_daily").select().eq("store_id", id),
  ]);
  throwQueryError(campaignsResult.error);
  throwQueryError(spendResult.error);
  const spendByCampaign = new Map<string, AdSpendDailyRow>();
  for (const record of spendResult.data ?? []) {
    if (!record.campaign_id) continue;
    const current = spendByCampaign.get(record.campaign_id);
    spendByCampaign.set(record.campaign_id, current
      ? { ...current, spend: current.spend + record.spend, impressions: current.impressions + record.impressions, clicks: current.clicks + record.clicks, platform_conversions: current.platform_conversions + record.platform_conversions, platform_conversion_value: current.platform_conversion_value + record.platform_conversion_value }
      : record);
  }
  return (campaignsResult.data ?? []).map((campaign) => {
    const performance = spendByCampaign.get(campaign.id);
    return {
      campaign,
      spend: performance?.spend ?? 0,
      impressions: performance?.impressions ?? 0,
      clicks: performance?.clicks ?? 0,
      platformConversions: performance?.platform_conversions ?? 0,
      platformConversionValue: performance?.platform_conversion_value ?? 0,
    };
  });
}
