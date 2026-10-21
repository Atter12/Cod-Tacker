import "server-only";

import {
  evaluateMonthlyOrderUsage,
  planUpgradeMessage,
  type MonthlyOrderUsage,
  type PlanEntitlements,
  type PlanSection,
} from "@/lib/billing/entitlements";
import { currentPeriodKey, loadAgencyEntitlements, type PlanLimits } from "@/lib/billing/limits";
import { ValidationError } from "@/lib/errors";
import { createAdminClient } from "@/lib/supabase/admin";
import type { DatabaseClient } from "@/services/_shared";

export async function getAgencyEntitlements(
  agencyId: string,
  client: DatabaseClient = createAdminClient(),
): Promise<{ entitlements: PlanEntitlements; limits: PlanLimits | null }> {
  return loadAgencyEntitlements(client, agencyId);
}

export async function agencyPlanAllows(
  agencyId: string,
  section: PlanSection,
  client?: DatabaseClient,
): Promise<boolean> {
  const { entitlements } = await getAgencyEntitlements(agencyId, client);
  return entitlements.sections[section];
}

/** Server actions: throw the upgrade message when the plan does not unlock `section`. */
export async function assertPlanSection(agencyId: string, section: PlanSection): Promise<void> {
  if (!(await agencyPlanAllows(agencyId, section))) {
    throw new ValidationError(planUpgradeMessage(section));
  }
}

/** Orders created this month across the agency (Shopify sync included). */
export async function getMonthlyOrderUsage(
  agencyId: string,
  entitlements: PlanEntitlements,
  limits: PlanLimits | null,
  client: DatabaseClient = createAdminClient(),
): Promise<MonthlyOrderUsage> {
  const start = `${currentPeriodKey()}-01T00:00:00.000Z`;
  const { count } = await client
    .from("orders")
    .select("id", { count: "exact", head: true })
    .eq("agency_id", agencyId)
    .gte("created_at", start);
  return evaluateMonthlyOrderUsage({
    entitlements,
    orderLimit: limits?.orderLimit ?? null,
    used: count ?? 0,
  });
}
