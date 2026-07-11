import { computeAdsKpis } from "@/lib/attribution/metrics";
import type { AdCampaignRow, AdSpendDailyRow } from "@/types/database";
import {
  getCampaignPerformanceRpc,
  type CampaignPerfRow,
} from "@/services/attribution.service";
import { requireValue, throwQueryError, type DatabaseClient } from "./_shared";

export type CampaignPerformance = {
  campaign: AdCampaignRow;
  spend: number;
  impressions: number;
  clicks: number;
  platformConversions: number;
  platformConversionValue: number;
  ordersAttributed: number;
  revenueGenerated: number;
  deliveredValue: number;
  collectedValue: number;
  settledValue: number;
  roasGenerated: number | null;
  roasDelivered: number | null;
  roasCollected: number | null;
  roasSettled: number | null;
  avgConfidence: number;
};

/** Prefer SQL RPC when available; falls back to client aggregation. */
export async function listCampaigns(
  client: DatabaseClient,
  storeId: string,
  dateRange?: { from: string; to: string },
): Promise<CampaignPerformance[]> {
  const id = requireValue(storeId, "Tienda inválida.");
  const from = dateRange?.from ?? "1970-01-01";
  const to = dateRange?.to ?? new Date().toISOString().slice(0, 10);

  try {
    const rpcRows = await getCampaignPerformanceRpc(client, id, from, to);
    if (rpcRows.length) {
      return mapRpcToPerformance(client, id, rpcRows);
    }
  } catch {
    // Fall through to client-side aggregation when RPC not yet migrated.
  }

  const [campaignsResult, spendResult] = await Promise.all([
    client.from("ad_campaigns").select().eq("store_id", id).order("name"),
    client
      .from("ad_spend_daily")
      .select()
      .eq("store_id", id)
      .gte("metric_date", from)
      .lte("metric_date", to),
  ]);
  throwQueryError(campaignsResult.error);
  throwQueryError(spendResult.error);

  const spendByCampaign = new Map<string, AdSpendDailyRow>();
  for (const record of spendResult.data ?? []) {
    if (!record.campaign_id) continue;
    const current = spendByCampaign.get(record.campaign_id);
    spendByCampaign.set(
      record.campaign_id,
      current
        ? {
            ...current,
            spend: current.spend + record.spend,
            impressions: current.impressions + record.impressions,
            clicks: current.clicks + record.clicks,
            platform_conversions: current.platform_conversions + record.platform_conversions,
            platform_conversion_value:
              current.platform_conversion_value + record.platform_conversion_value,
          }
        : record,
    );
  }

  return (campaignsResult.data ?? []).map((campaign) => {
    const performance = spendByCampaign.get(campaign.id);
    const spend = performance?.spend ?? 0;
    const kpis = computeAdsKpis({
      spend,
      impressions: performance?.impressions ?? 0,
      clicks: performance?.clicks ?? 0,
      ordersGenerated: performance?.platform_conversions ?? 0,
      ordersConfirmed: performance?.platform_conversions ?? 0,
      ordersShipped: performance?.platform_conversions ?? 0,
      ordersDelivered: performance?.platform_conversions ?? 0,
      ordersRejected: 0,
      ordersReturned: 0,
      revenueGenerated: performance?.platform_conversion_value ?? 0,
      deliveredValue: performance?.platform_conversion_value ?? 0,
      collectedValue: 0,
      settledValue: 0,
    });
    return {
      campaign,
      spend,
      impressions: performance?.impressions ?? 0,
      clicks: performance?.clicks ?? 0,
      platformConversions: performance?.platform_conversions ?? 0,
      platformConversionValue: performance?.platform_conversion_value ?? 0,
      ordersAttributed: performance?.platform_conversions ?? 0,
      revenueGenerated: performance?.platform_conversion_value ?? 0,
      deliveredValue: performance?.platform_conversion_value ?? 0,
      collectedValue: 0,
      settledValue: 0,
      roasGenerated: kpis.roasGenerated,
      roasDelivered: kpis.roasDelivered,
      roasCollected: kpis.roasCollected,
      roasSettled: kpis.roasSettled,
      avgConfidence: 0,
    };
  });
}

async function mapRpcToPerformance(
  client: DatabaseClient,
  storeId: string,
  rpcRows: CampaignPerfRow[],
): Promise<CampaignPerformance[]> {
  const campaignsResult = await client.from("ad_campaigns").select().eq("store_id", storeId);
  throwQueryError(campaignsResult.error);
  const byId = new Map((campaignsResult.data ?? []).map((c) => [c.id, c]));

  return rpcRows
    .map((row) => {
      const campaign = byId.get(row.campaign_id);
      if (!campaign) return null;
      const kpis = computeAdsKpis({
        spend: Number(row.spend),
        impressions: Number(row.impressions),
        clicks: Number(row.clicks),
        ordersGenerated: Number(row.orders_attributed),
        ordersConfirmed: Number(row.orders_attributed),
        ordersShipped: Number(row.orders_attributed),
        ordersDelivered: Number(row.orders_attributed),
        ordersRejected: 0,
        ordersReturned: 0,
        revenueGenerated: Number(row.revenue_generated),
        deliveredValue: Number(row.delivered_value),
        collectedValue: Number(row.collected_value),
        settledValue: Number(row.settled_value),
        avgConfidence: Number(row.avg_confidence),
      });
      return {
        campaign,
        spend: kpis.spend,
        impressions: kpis.impressions,
        clicks: kpis.clicks,
        platformConversions: kpis.ordersGenerated,
        platformConversionValue: kpis.revenueGenerated,
        ordersAttributed: kpis.ordersGenerated,
        revenueGenerated: kpis.revenueGenerated,
        deliveredValue: kpis.deliveredValue,
        collectedValue: kpis.collectedValue,
        settledValue: kpis.settledValue,
        roasGenerated: kpis.roasGenerated,
        roasDelivered: kpis.roasDelivered,
        roasCollected: kpis.roasCollected,
        roasSettled: kpis.roasSettled,
        avgConfidence: Number(row.avg_confidence),
      } satisfies CampaignPerformance;
    })
    .filter((x): x is CampaignPerformance => x != null);
}
