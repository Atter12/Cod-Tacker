import type { IntegrationOverviewItem } from "@/types/integrations";
import { IntegrationOverviewCard } from "./IntegrationOverviewCard";

export type IntegrationsGridProps = {
  items: IntegrationOverviewItem[];
  agencySlug: string;
  storeSlug: string;
};

export function IntegrationsGrid({ items, agencySlug, storeSlug }: IntegrationsGridProps) {
  return (
    <ul className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:gap-5">
      {items.map((item) => (
        <li key={item.id ?? item.provider}>
          <IntegrationOverviewCard
            item={item}
            agencySlug={agencySlug}
            storeSlug={storeSlug}
          />
        </li>
      ))}
    </ul>
  );
}
