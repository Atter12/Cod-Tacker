import type { IntegrationOverviewItem } from "@/types/integrations";
import { IntegrationCatalogCard } from "./IntegrationCatalogCard";

export function IntegrationCatalogGrid({
  items,
  agencySlug,
  storeSlug,
  canManage,
  demo = false,
}: {
  items: IntegrationOverviewItem[];
  agencySlug: string;
  storeSlug: string;
  canManage: boolean;
  demo?: boolean;
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
          />
        </li>
      ))}
    </ul>
  );
}
