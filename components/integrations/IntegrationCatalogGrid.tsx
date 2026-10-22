import type { PlanSection } from "@/lib/billing/entitlements";
import type { IntegrationOverviewItem } from "@/types/integrations";
import { IntegrationCatalogCard } from "./IntegrationCatalogCard";

export function IntegrationCatalogGrid({
  items,
  agencySlug,
  storeSlug,
  canManage,
  demo = false,
  lockedProviders = {},
}: {
  items: IntegrationOverviewItem[];
  agencySlug: string;
  storeSlug: string;
  canManage: boolean;
  demo?: boolean;
  lockedProviders?: Readonly<Record<string, PlanSection>>;
}) {
  if (items.length === 0) return null;

  return (
    <ul className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      {items.map((item) => (
        <li key={item.provider}>
          <IntegrationCatalogCard
            item={item}
            agencySlug={agencySlug}
            storeSlug={storeSlug}
            canManage={canManage}
            demo={demo}
            lockedSection={lockedProviders[item.provider]}
          />
        </li>
      ))}
    </ul>
  );
}
