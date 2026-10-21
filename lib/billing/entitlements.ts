/**
 * What each plan unlocks (pure — server and client).
 *
 *   Free (no plan, or a blocked one) — Shopify connector: orders, overview,
 *     integrations, Flipy, operations and settings.
 *   Starter — full console for the store: attribution, campaigns, RTO,
 *     reconciliation, logistics and alerts.
 *   Growth  — + WhatsApp and automations (`plans.features`).
 *   Scale   — + API keys (`plans.features.api`).
 *
 * Store and monthly order limits stay in `plans.store_limit` / `order_limit`.
 */

export type PlanSection = "console" | "whatsapp" | "automations" | "api";

export type PlanEntitlementsInput = {
  planCode: string | null;
  planName: string | null;
  features: Record<string, unknown>;
  /** From evaluateSubscriptionAccess: active, trialing or within grace. */
  accessAllowed: boolean;
};

export type PlanEntitlements = {
  tier: "free" | "paid";
  planCode: string | null;
  planName: string | null;
  sections: Record<PlanSection, boolean>;
};

const FREE_SECTIONS: Record<PlanSection, boolean> = {
  console: false,
  whatsapp: false,
  automations: false,
  api: false,
};

export function resolvePlanEntitlements(input: PlanEntitlementsInput | null): PlanEntitlements {
  if (!input || !input.accessAllowed) {
    return { tier: "free", planCode: null, planName: null, sections: { ...FREE_SECTIONS } };
  }
  return {
    tier: "paid",
    planCode: input.planCode,
    planName: input.planName,
    sections: {
      console: true,
      whatsapp: input.features.whatsapp === true,
      automations: input.features.automations === true,
      api: input.features.api === true,
    },
  };
}

/** Cheapest self-serve plan that unlocks each section. */
export const PLAN_SECTION_MIN_PLAN: Record<PlanSection, string> = {
  console: "Starter",
  whatsapp: "Growth",
  automations: "Growth",
  api: "Scale",
};

const PLAN_SECTION_LABEL: Record<PlanSection, string> = {
  console: "Esta sección de la consola",
  whatsapp: "WhatsApp",
  automations: "Las automatizaciones",
  api: "Las claves API",
};

export function planUpgradeMessage(section: PlanSection): string {
  return `${PLAN_SECTION_LABEL[section]} requiere el plan ${PLAN_SECTION_MIN_PLAN[section]} o superior.`;
}

/** Store console paths (after `/s/[storeSlug]`) and the section each needs. */
const STORE_PATH_SECTIONS: Array<[prefix: string, section: PlanSection]> = [
  ["/attribution", "console"],
  ["/campaigns", "console"],
  ["/ads", "console"],
  ["/rto", "console"],
  ["/reconciliation", "console"],
  ["/logistics", "console"],
  ["/alerts", "console"],
  ["/whatsapp", "whatsapp"],
  ["/automations", "automations"],
];

export function storePathPlanSection(subpath: string): PlanSection | null {
  for (const [prefix, section] of STORE_PATH_SECTIONS) {
    if (subpath === prefix || subpath.startsWith(`${prefix}/`)) return section;
  }
  return null;
}

/** Store nav hrefs the plan does not unlock (shown with a lock, still linkable). */
export function lockedStoreNavHrefs(
  entitlements: PlanEntitlements,
  hrefs: readonly string[],
): string[] {
  return hrefs.filter((href) => {
    const section = storePathPlanSection(href);
    return section !== null && !entitlements.sections[section];
  });
}

export type MonthlyOrderUsage = {
  used: number;
  limit: number | null;
  overLimit: boolean;
};

/** Paid plans only: Shopify orders keep syncing; over the limit is a warning. */
export function evaluateMonthlyOrderUsage(input: {
  entitlements: PlanEntitlements;
  orderLimit: number | null;
  used: number;
}): MonthlyOrderUsage {
  const limit = input.entitlements.tier === "paid" ? input.orderLimit : null;
  return {
    used: input.used,
    limit,
    overLimit: limit !== null && input.used > limit,
  };
}
