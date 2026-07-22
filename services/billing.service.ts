import { throwQueryError, type DatabaseClient } from "./_shared";
import {
  getAgencyPlanLimits,
  currentPeriodKey,
  type PlanLimits,
} from "@/lib/billing/limits";
import type { InvoiceRecordRow, PlanRow } from "@/types/database";

const PLAN_DISPLAY_ORDER = ["starter", "growth", "scale", "agency", "enterprise"] as const;

export type BillingPlanCard = Pick<
  PlanRow,
  | "id"
  | "code"
  | "name"
  | "monthly_price"
  | "annual_price"
  | "currency_code"
  | "store_limit"
  | "order_limit"
  | "features"
>;

export type BillingOverview = {
  limits: PlanLimits | null;
  subscriptionId: string | null;
  /** From subscription.metadata.billing_interval when present. */
  billingInterval: "month" | "year" | null;
  storeCount: number;
  orderCountThisMonth: number;
  invoices: InvoiceRecordRow[];
  availablePlans: BillingPlanCard[];
};

function sortPlansForDisplay(plans: BillingPlanCard[]): BillingPlanCard[] {
  const rank = new Map<string, number>(
    PLAN_DISPLAY_ORDER.map((code, index) => [code, index]),
  );
  return [...plans].sort((a, b) => {
    const ra = rank.get(a.code) ?? 100 + Number(a.monthly_price);
    const rb = rank.get(b.code) ?? 100 + Number(b.monthly_price);
    return ra - rb;
  });
}

export async function getBillingOverview(
  client: DatabaseClient,
  agencyId: string,
): Promise<BillingOverview> {
  const limits = await getAgencyPlanLimits(client, agencyId);

  const [{ count: storeCount }, { data: storeRows }, { data: invoices }, { data: plans }, sub] =
    await Promise.all([
      client.from("stores").select("*", { count: "exact", head: true }).eq("agency_id", agencyId).eq("is_active", true),
      client.from("stores").select("id").eq("agency_id", agencyId),
      client
        .from("invoice_records")
        .select("*")
        .eq("agency_id", agencyId)
        .order("issued_at", { ascending: false })
        .limit(24),
      client
        .from("plans")
        .select(
          "id, code, name, monthly_price, annual_price, currency_code, store_limit, order_limit, features",
        )
        .eq("is_active", true)
        .eq("is_public", true)
        .order("monthly_price", { ascending: true }),
      client
        .from("subscriptions")
        .select("id, metadata")
        .eq("agency_id", agencyId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

  const storeIds = (storeRows ?? []).map((s) => s.id);
  let orderCountThisMonth = 0;
  const periodKey = currentPeriodKey();
  const { data: counter } = await client
    .from("usage_counters")
    .select("quantity")
    .eq("agency_id", agencyId)
    .eq("metric", "orders")
    .eq("period_key", periodKey)
    .is("store_id", null)
    .maybeSingle();

  if (counter) {
    orderCountThisMonth = counter.quantity;
  } else if (storeIds.length) {
    const start = `${periodKey}-01T00:00:00.000Z`;
    const { count } = await client
      .from("orders")
      .select("id", { count: "exact", head: true })
      .in("store_id", storeIds)
      .gte("created_at", start);
    orderCountThisMonth = count ?? 0;
  }

  const subMeta =
    sub.data?.metadata &&
    typeof sub.data.metadata === "object" &&
    !Array.isArray(sub.data.metadata)
      ? (sub.data.metadata as Record<string, unknown>)
      : {};
  const billingInterval =
    subMeta.billing_interval === "year" || subMeta.billing_interval === "month"
      ? subMeta.billing_interval
      : null;

  return {
    limits,
    subscriptionId: sub.data?.id ?? null,
    billingInterval,
    storeCount: storeCount ?? 0,
    orderCountThisMonth,
    invoices: invoices ?? [],
    availablePlans: sortPlansForDisplay((plans ?? []) as BillingPlanCard[]),
  };
}

export async function listPublicPlans(client: DatabaseClient) {
  const { data, error } = await client
    .from("plans")
    .select("id, code, name, monthly_price, annual_price, store_limit, order_limit, features, currency_code")
    .eq("is_active", true)
    .eq("is_public", true)
    .order("monthly_price", { ascending: true });
  throwQueryError(error);
  return data ?? [];
}
