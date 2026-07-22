import type { DatabaseClient } from "@/services/_shared";
import { ValidationError } from "@/lib/errors";
import { assertSubscriptionAllowsAccess as assertAccessPolicy } from "@/lib/billing/access-policy";

/**
 * Soft defaults when an agency has no subscription row yet.
 * Must match the `starter` plan in `public.plans` (DB is source of truth).
 */
export const STARTER_DEFAULT_STORE_LIMIT = 1;
export const STARTER_DEFAULT_ORDER_LIMIT = 300;

export type PlanLimits = {
  planId: string;
  planCode: string;
  planName: string;
  storeLimit: number | null;
  orderLimit: number | null;
  features: Record<string, unknown>;
  subscriptionStatus: string;
  cancelAtPeriodEnd: boolean;
  trialEndsAt: string | null;
  currentPeriodEnd: string | null;
  gracePeriodEndsAt: string | null;
  /** ISO when Stripe first reported past_due (metadata.past_due_since). */
  pastDueSince: string | null;
};

function asFeatures(raw: unknown): Record<string, unknown> {
  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    return raw as Record<string, unknown>;
  }
  return {};
}

/**
 * Loads the latest subscription + plan for an agency.
 * Returns null when no subscription exists (caller should treat as starter defaults or block).
 */
export async function getAgencyPlanLimits(
  client: DatabaseClient,
  agencyId: string,
): Promise<PlanLimits | null> {
  const { data: sub, error } = await client
    .from("subscriptions")
    .select(
      "id, status, cancel_at_period_end, trial_ends_at, current_period_end, metadata, plan_id",
    )
    .eq("agency_id", agencyId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  if (!sub) return null;

  const { data: plan, error: planError } = await client
    .from("plans")
    .select("id, code, name, store_limit, order_limit, features")
    .eq("id", sub.plan_id)
    .maybeSingle();
  if (planError) throw planError;
  if (!plan) return null;

  const meta =
    sub.metadata && typeof sub.metadata === "object" && !Array.isArray(sub.metadata)
      ? (sub.metadata as Record<string, unknown>)
      : {};
  const grace =
    typeof meta.grace_period_ends_at === "string" ? meta.grace_period_ends_at : null;
  const pastDueSince =
    typeof meta.past_due_since === "string" ? meta.past_due_since : null;

  return {
    planId: plan.id,
    planCode: plan.code,
    planName: plan.name,
    storeLimit: plan.store_limit,
    orderLimit: plan.order_limit,
    features: asFeatures(plan.features),
    subscriptionStatus: sub.status,
    cancelAtPeriodEnd: sub.cancel_at_period_end,
    trialEndsAt: sub.trial_ends_at,
    currentPeriodEnd: sub.current_period_end,
    gracePeriodEndsAt: grace,
    pastDueSince,
  };
}

/** @see evaluateSubscriptionAccess in access-policy.ts */
export function assertSubscriptionAllowsAccess(limits: PlanLimits | null): void {
  assertAccessPolicy(limits);
}

export async function assertCanCreateStore(
  client: DatabaseClient,
  agencyId: string,
): Promise<void> {
  const limits = await getAgencyPlanLimits(client, agencyId);
  assertSubscriptionAllowsAccess(limits);

  const { count, error } = await client
    .from("stores")
    .select("*", { count: "exact", head: true })
    .eq("agency_id", agencyId)
    .eq("is_active", true);
  if (error) throw error;

  const storeLimit = limits?.storeLimit ?? STARTER_DEFAULT_STORE_LIMIT;
  if (storeLimit !== null && (count ?? 0) >= storeLimit) {
    throw new ValidationError(
      `Has alcanzado el límite de ${storeLimit} tienda(s) de tu plan${limits ? ` (${limits.planName})` : ""}. Mejora el plan para crear más.`,
    );
  }
}

/**
 * Enforces monthly order_limit for bulk CSV imports (rows count as potential orders).
 * Feature flags come from `plans.features` in the DB.
 */
export async function assertCanImportCsvRows(
  client: DatabaseClient,
  agencyId: string,
  rowCount: number,
): Promise<void> {
  const limits = await getAgencyPlanLimits(client, agencyId);
  assertSubscriptionAllowsAccess(limits);

  // Optional explicit deny; missing key = allowed (catalog may omit csv_import).
  if (limits && limits.features.csv_import === false) {
    throw new ValidationError("Tu plan no incluye importación masiva CSV.");
  }

  const orderLimit = limits?.orderLimit ?? STARTER_DEFAULT_ORDER_LIMIT;
  if (orderLimit === null) return;

  const periodKey = new Date().toISOString().slice(0, 7); // YYYY-MM
  const { data: counter } = await client
    .from("usage_counters")
    .select("quantity")
    .eq("agency_id", agencyId)
    .eq("metric", "orders")
    .eq("period_key", periodKey)
    .is("store_id", null)
    .maybeSingle();

  // Fallback: count real orders this month if counter missing
  let used = counter?.quantity ?? 0;
  if (!counter) {
    const start = `${periodKey}-01T00:00:00.000Z`;
    const { data: storeRows } = await client.from("stores").select("id").eq("agency_id", agencyId);
    const storeIds = (storeRows ?? []).map((s) => s.id);
    if (storeIds.length) {
      const { count } = await client
        .from("orders")
        .select("id", { count: "exact", head: true })
        .in("store_id", storeIds)
        .gte("created_at", start);
      used = count ?? 0;
    }
  }

  if (used + rowCount > orderLimit) {
    throw new ValidationError(
      `La importación excedería el límite mensual de ${orderLimit} pedidos del plan (${used} ya usados). Reduce el archivo o mejora el plan.`,
    );
  }
}

export function planAllowsWhiteLabel(limits: PlanLimits | null): boolean {
  if (!limits) return false;
  // Canonical catalog uses `white_label`; keep hide_branding for older rows.
  return limits.features.white_label === true || limits.features.hide_branding === true;
}

export function planFeatureEnabled(limits: PlanLimits | null, feature: string): boolean {
  if (!limits) return false;
  return limits.features[feature] === true;
}

export function currentPeriodKey(date = new Date()): string {
  return date.toISOString().slice(0, 7);
}
