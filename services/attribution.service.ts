import type { AttributionFilters, ChannelAttribution } from "@/types/attribution";
import { requireValue, throwQueryError, type DatabaseClient } from "./_shared";

export type ListAttributionOptions = AttributionFilters & { storeId: string };

/** Services receive the request-scoped typed client so RLS remains enforced and callers can test queries. */
export async function listAttributionPerformance(client: DatabaseClient, options: ListAttributionOptions): Promise<ChannelAttribution[]> {
  let query = client.from("order_attributions").select("attributed_value, touchpoint_id, platform").eq("store_id", requireValue(options.storeId, "Tienda inválida.")).gte("calculated_at", options.from).lte("calculated_at", options.to);
  if (options.model) query = query.eq("model", options.model);
  const [result, touchpointsResult] = await Promise.all([
    query,
    client.from("attribution_touchpoints").select("id, platform").eq("store_id", options.storeId).gte("occurred_at", options.from).lte("occurred_at", options.to),
  ]);
  throwQueryError(result.error);
  throwQueryError(touchpointsResult.error);
  const touchpoints = new Map((touchpointsResult.data ?? []).map((touchpoint) => [touchpoint.id, touchpoint]));
  const totals = new Map<string, { revenue: number; orders: number }>();
  for (const attribution of result.data ?? []) {
    const touchpoint = attribution.touchpoint_id ? touchpoints.get(attribution.touchpoint_id) : undefined;
    const platform = attribution.platform ?? touchpoint?.platform ?? "unattributed";
    if (options.platforms?.length && !options.platforms.includes(platform as (typeof options.platforms)[number])) continue;
    const total = totals.get(platform) ?? { revenue: 0, orders: 0 };
    total.revenue += attribution.attributed_value;
    total.orders += 1;
    totals.set(platform, total);
  }
  return [...totals.entries()].map(([platform, total]) => ({ platform, ...total, spend: 0, roas: null }));
}
