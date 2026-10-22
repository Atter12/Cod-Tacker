import "server-only";

import { PlanUpsellCard } from "@/components/billing/PlanUpsell";
import { routes } from "@/config/routes";
import type { PlanSection } from "@/lib/billing/entitlements";
import { agencyPlanAllows } from "@/lib/billing/plan-gate";
import { requireAgencyAccess } from "@/lib/tenant/require-agency-access";
import { requireStoreAccess } from "@/lib/tenant/require-store-access";

/**
 * Renders children only when the agency plan unlocks `section`; otherwise a calm
 * upgrade card that leads to Facturación (Shopify plans open App Pricing there).
 */
export async function PlanGate({
  agencySlug,
  storeSlug,
  section,
  children,
}: {
  agencySlug: string;
  storeSlug?: string;
  section: PlanSection;
  children: React.ReactNode;
}) {
  const membership = storeSlug
    ? await requireStoreAccess(agencySlug, storeSlug)
    : await requireAgencyAccess(agencySlug);
  if (await agencyPlanAllows(membership.agencyId, section)) return children;

  // A Starter store can go back to its overview; without a plan there is nothing to go back to.
  const backHref =
    storeSlug && section !== "console" ? routes.store.dashboard(agencySlug, storeSlug) : undefined;
  return <PlanUpsellCard agencySlug={agencySlug} section={section} backHref={backHref} />;
}
