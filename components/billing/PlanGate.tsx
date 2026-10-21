import "server-only";

import { Lock } from "lucide-react";
import { EmptyState } from "@/components/ui";
import { routes } from "@/config/routes";
import { planUpgradeMessage, type PlanSection } from "@/lib/billing/entitlements";
import { agencyPlanAllows } from "@/lib/billing/plan-gate";
import { requireAgencyAccess } from "@/lib/tenant/require-agency-access";
import { requireStoreAccess } from "@/lib/tenant/require-store-access";

/**
 * Renders children only when the agency plan unlocks `section`; otherwise an
 * upgrade notice that leads to Facturación (Shopify plans open App Pricing there).
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

  return (
    <div className="mx-auto max-w-2xl py-10">
      <EmptyState
        icon={<Lock className="size-8" aria-hidden />}
        title="Función de un plan de pago"
        description={`${planUpgradeMessage(section)} La tienda conectada desde Shopify sigue sincronizando pedidos con el plan gratis.`}
        action={{ label: "Ver planes", href: routes.agency.billing(agencySlug) }}
      />
    </div>
  );
}
