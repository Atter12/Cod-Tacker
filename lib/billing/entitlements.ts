/**
 * What each plan unlocks (pure — server and client). There is no free plan:
 * without an active plan only Facturación, Integraciones and Configuración stay
 * open, and Shopify orders keep syncing in the background.
 *
 *   Starter — store console: orders, overview (ROAS / RTO), Flipy and couriers,
 *     attribution, campaigns, RTO, alerts, operations.
 *   Growth  — + reconciliation, WhatsApp and automations (`plans.features`).
 *   Scale   — + conversions to Meta / TikTok, API keys and white label.
 *
 * Store and monthly order limits stay in `plans.store_limit` / `order_limit`.
 */

export type PlanSection =
  | "console"
  | "reconciliation"
  | "whatsapp"
  | "automations"
  | "conversions"
  | "api";

export type PlanEntitlementsInput = {
  planCode: string | null;
  planName: string | null;
  features: Record<string, unknown>;
  /** From evaluateSubscriptionAccess: active, trialing or within grace. */
  accessAllowed: boolean;
};

export type PlanEntitlements = {
  tier: "none" | "paid";
  planCode: string | null;
  planName: string | null;
  sections: Record<PlanSection, boolean>;
};

const NO_PLAN_SECTIONS: Record<PlanSection, boolean> = {
  console: false,
  reconciliation: false,
  whatsapp: false,
  automations: false,
  conversions: false,
  api: false,
};

export function resolvePlanEntitlements(input: PlanEntitlementsInput | null): PlanEntitlements {
  if (!input || !input.accessAllowed) {
    return { tier: "none", planCode: null, planName: null, sections: { ...NO_PLAN_SECTIONS } };
  }
  return {
    tier: "paid",
    planCode: input.planCode,
    planName: input.planName,
    sections: {
      console: true,
      reconciliation: input.features.reconciliation === true,
      whatsapp: input.features.whatsapp === true,
      automations: input.features.automations === true,
      conversions: input.features.conversions === true,
      api: input.features.api === true,
    },
  };
}

/** Cheapest self-serve plan that unlocks each section. */
export const PLAN_SECTION_MIN_PLAN: Record<PlanSection, string> = {
  console: "Starter",
  reconciliation: "Growth",
  whatsapp: "Growth",
  automations: "Growth",
  conversions: "Scale",
  api: "Scale",
};

const PLAN_SECTION_LABEL: Record<PlanSection, string> = {
  console: "CODTracked",
  reconciliation: "La conciliación de cobros",
  whatsapp: "WhatsApp",
  automations: "Las automatizaciones",
  conversions: "El envío de conversiones a Meta y TikTok",
  api: "Las claves API",
};

export function planUpgradeMessage(section: PlanSection): string {
  if (section === "console") {
    return "Elige un plan (Starter o superior) para usar CODTracked en esta tienda.";
  }
  return `${PLAN_SECTION_LABEL[section]} requiere el plan ${PLAN_SECTION_MIN_PLAN[section]} o superior.`;
}

/** Store console paths (after `/s/[storeSlug]`) and the section each needs. */
const STORE_PATH_SECTIONS: Array<[prefix: string, section: PlanSection]> = [
  ["/dashboard", "console"],
  ["/orders", "console"],
  ["/flipy", "console"],
  ["/logistics", "console"],
  ["/operations", "console"],
  ["/attribution", "console"],
  ["/campaigns", "console"],
  ["/ads", "console"],
  ["/rto", "console"],
  ["/alerts", "console"],
  ["/reconciliation", "reconciliation"],
  ["/whatsapp", "whatsapp"],
  ["/automations", "automations"],
];

/** Integrations and settings stay open so the merchant can connect and pick a plan. */
export function storePathPlanSection(subpath: string): PlanSection | null {
  if (subpath === "") return "console";
  for (const [prefix, section] of STORE_PATH_SECTIONS) {
    if (subpath === prefix || subpath.startsWith(`${prefix}/`)) return section;
  }
  return null;
}

/**
 * Integration detail pages that only make sense with a plan. Shopify, ads and
 * couriers stay connectable without one (connecting is how setup starts).
 */
export function integrationProviderPlanSection(provider: string): PlanSection | null {
  if (provider === "flipy") return "console";
  if (provider === "whatsapp") return "whatsapp";
  return null;
}

/** Agency console paths (after `/a/[agencySlug]`) gated by plan. */
export function agencyPathPlanSection(subpath: string): PlanSection | null {
  return subpath === "/api-keys" || subpath.startsWith("/api-keys/") ? "api" : null;
}

export function navPathPlanSection(
  scope: "store" | "agency" | "admin",
  href: string,
): PlanSection | null {
  if (scope === "store") return storePathPlanSection(href);
  if (scope === "agency") return agencyPathPlanSection(href);
  return null;
}

/** Nav hrefs the plan does not unlock (shown with a plan pill, still linkable). */
export function lockedNavHrefs(
  scope: "store" | "agency",
  entitlements: PlanEntitlements,
  hrefs: readonly string[],
): string[] {
  return hrefs.filter((href) => {
    const section = navPathPlanSection(scope, href);
    return section !== null && !entitlements.sections[section];
  });
}

export function lockedStoreNavHrefs(
  entitlements: PlanEntitlements,
  hrefs: readonly string[],
): string[] {
  return lockedNavHrefs("store", entitlements, hrefs);
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
