import { computeAdsKpis, formatRate, formatRoas } from "@/lib/attribution/metrics";
import type { ChannelAttribution } from "@/types/attribution";
import type { AdAccountRow, AdCampaignRow, AdRow, AdSetRow } from "@/types/database";
import { requireValue, throwQueryError, type DatabaseClient } from "./_shared";

export type FunnelRow = {
  orders_total: number;
  confirmed: number;
  shipped: number;
  delivered: number;
  rejected: number;
  returned: number;
  revenue_generated: number;
  delivered_value: number;
  collected_value: number;
  settled_value: number;
};

export type CampaignPerfRow = {
  campaign_id: string;
  campaign_name: string;
  platform: string;
  spend: number;
  impressions: number;
  clicks: number;
  orders_attributed: number;
  revenue_generated: number;
  delivered_value: number;
  collected_value: number;
  settled_value: number;
  avg_confidence: number;
};

export type RtoBreakdownRow = {
  dimension_key: string;
  dimension_label: string;
  shipments_total: number;
  rto_count: number;
  delivered_count: number;
  rto_rate: number;
};

export type DailyTrendRow = {
  metric_date: string;
  spend: number;
  attributed_revenue: number;
  orders_attributed: number;
};

export async function getStoreFunnel(
  client: DatabaseClient,
  storeId: string,
  from: string,
  to: string,
): Promise<FunnelRow | null> {
  const result = await client.rpc("rpc_store_order_funnel", {
    p_store_id: requireValue(storeId, "Tienda inválida."),
    p_from: from,
    p_to: to,
  });
  throwQueryError(result.error);
  return (result.data?.[0] as FunnelRow | undefined) ?? null;
}

export async function getCampaignPerformanceRpc(
  client: DatabaseClient,
  storeId: string,
  fromDate: string,
  toDate: string,
): Promise<CampaignPerfRow[]> {
  const result = await client.rpc("rpc_store_campaign_performance", {
    p_store_id: requireValue(storeId, "Tienda inválida."),
    p_from: fromDate,
    p_to: toDate,
  });
  throwQueryError(result.error);
  return (result.data as CampaignPerfRow[] | null) ?? [];
}

export async function getRtoBreakdown(
  client: DatabaseClient,
  storeId: string,
  from: string,
  to: string,
  dimension = "city",
): Promise<RtoBreakdownRow[]> {
  const result = await client.rpc("rpc_store_rto_breakdown", {
    p_store_id: requireValue(storeId, "Tienda inválida."),
    p_from: from,
    p_to: to,
    p_dimension: dimension,
  });
  throwQueryError(result.error);
  return (result.data as RtoBreakdownRow[] | null) ?? [];
}

export async function getAdsDailyTrend(
  client: DatabaseClient,
  storeId: string,
  fromDate: string,
  toDate: string,
): Promise<DailyTrendRow[]> {
  const result = await client.rpc("rpc_store_ads_daily_trend", {
    p_store_id: requireValue(storeId, "Tienda inválida."),
    p_from: fromDate,
    p_to: toDate,
  });
  throwQueryError(result.error);
  return (result.data as DailyTrendRow[] | null) ?? [];
}

/** Platform rollup with real spend join for ROAS. */
export async function listAttributionPerformance(
  client: DatabaseClient,
  options: {
    storeId: string;
    from: string;
    to: string;
    model?: string;
    platforms?: string[];
  },
): Promise<ChannelAttribution[]> {
  const storeId = requireValue(options.storeId, "Tienda inválida.");
  let attrQuery = client
    .from("order_attributions")
    .select("attributed_value, touchpoint_id, platform, order_id, model, confidence_score, is_primary")
    .eq("store_id", storeId)
    .gte("calculated_at", options.from)
    .lte("calculated_at", options.to);
  if (options.model) attrQuery = attrQuery.eq("model", options.model as never);

  const fromDate = options.from.slice(0, 10);
  const toDate = options.to.slice(0, 10);

  const [attrResult, spendResult] = await Promise.all([
    attrQuery,
    client
      .from("ad_spend_daily")
      .select("spend, platform")
      .eq("store_id", storeId)
      .gte("metric_date", fromDate)
      .lte("metric_date", toDate),
  ]);
  throwQueryError(attrResult.error);
  throwQueryError(spendResult.error);

  const spendByPlatform = new Map<string, number>();
  for (const row of spendResult.data ?? []) {
    spendByPlatform.set(row.platform, (spendByPlatform.get(row.platform) ?? 0) + row.spend);
  }

  const totals = new Map<string, { revenue: number; orders: number }>();
  for (const attribution of attrResult.data ?? []) {
    const platform = attribution.platform ?? "unattributed";
    if (options.platforms?.length && !options.platforms.includes(platform)) continue;
    const total = totals.get(platform) ?? { revenue: 0, orders: 0 };
    total.revenue += attribution.attributed_value;
    total.orders += 1;
    totals.set(platform, total);
  }

  // Ensure unattributed appears even with 0 spend
  if (!totals.has("other") && !totals.has("unattributed")) {
    /* optional */
  }

  return [...totals.entries()].map(([platform, total]) => {
    const spend = spendByPlatform.get(platform) ?? 0;
    const kpis = computeAdsKpis({
      spend,
      ordersGenerated: total.orders,
      ordersConfirmed: total.orders,
      ordersShipped: total.orders,
      ordersDelivered: total.orders,
      ordersRejected: 0,
      ordersReturned: 0,
      revenueGenerated: total.revenue,
      deliveredValue: total.revenue,
      collectedValue: 0,
      settledValue: 0,
    });
    return {
      platform,
      revenue: total.revenue,
      orders: total.orders,
      spend,
      roas: kpis.roasGenerated,
    };
  });
}

export async function listAdAccounts(
  client: DatabaseClient,
  storeId: string,
): Promise<AdAccountRow[]> {
  const result = await client
    .from("ad_accounts")
    .select()
    .eq("store_id", requireValue(storeId, "Tienda inválida."))
    .order("name");
  throwQueryError(result.error);
  return result.data ?? [];
}

export async function getAdAccountById(
  client: DatabaseClient,
  storeId: string,
  accountId: string,
): Promise<AdAccountRow | null> {
  const result = await client
    .from("ad_accounts")
    .select()
    .eq("store_id", storeId)
    .eq("id", accountId)
    .maybeSingle();
  throwQueryError(result.error);
  return result.data;
}

export async function listCampaignsForAccount(
  client: DatabaseClient,
  storeId: string,
  accountId: string,
): Promise<AdCampaignRow[]> {
  const result = await client
    .from("ad_campaigns")
    .select()
    .eq("store_id", storeId)
    .eq("ad_account_id", accountId)
    .order("name");
  throwQueryError(result.error);
  return result.data ?? [];
}

export async function getCampaignById(
  client: DatabaseClient,
  storeId: string,
  campaignId: string,
): Promise<AdCampaignRow | null> {
  const result = await client
    .from("ad_campaigns")
    .select()
    .eq("store_id", storeId)
    .eq("id", campaignId)
    .maybeSingle();
  throwQueryError(result.error);
  return result.data;
}

export async function listAdSets(
  client: DatabaseClient,
  storeId: string,
  campaignId: string,
): Promise<AdSetRow[]> {
  const result = await client
    .from("ad_sets")
    .select()
    .eq("store_id", storeId)
    .eq("campaign_id", campaignId)
    .order("name");
  throwQueryError(result.error);
  return result.data ?? [];
}

export async function getAdSetById(
  client: DatabaseClient,
  storeId: string,
  adSetId: string,
): Promise<AdSetRow | null> {
  const result = await client
    .from("ad_sets")
    .select()
    .eq("store_id", storeId)
    .eq("id", adSetId)
    .maybeSingle();
  throwQueryError(result.error);
  return result.data;
}

export async function listAds(
  client: DatabaseClient,
  storeId: string,
  adSetId: string,
): Promise<AdRow[]> {
  const result = await client
    .from("ads")
    .select()
    .eq("store_id", storeId)
    .eq("ad_set_id", adSetId)
    .order("name");
  throwQueryError(result.error);
  return result.data ?? [];
}

export async function getAdById(
  client: DatabaseClient,
  storeId: string,
  adId: string,
): Promise<AdRow | null> {
  const result = await client
    .from("ads")
    .select()
    .eq("store_id", storeId)
    .eq("id", adId)
    .maybeSingle();
  throwQueryError(result.error);
  return result.data;
}

export async function listPrimaryAttributionsForCampaign(
  client: DatabaseClient,
  storeId: string,
  campaignId: string,
  limit = 50,
) {
  const result = await client
    .from("order_attributions")
    .select("id, order_id, attributed_value, model, confidence_score, attribution_reason, platform, is_primary")
    .eq("store_id", storeId)
    .eq("campaign_id", campaignId)
    .eq("is_primary", true)
    .order("calculated_at", { ascending: false })
    .limit(limit);
  throwQueryError(result.error);
  return result.data ?? [];
}

export { formatRate, formatRoas, computeAdsKpis };
