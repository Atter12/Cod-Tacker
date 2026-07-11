import { DemoModeBadge } from "@/components/ui/DemoModeBadge";
import { PageHeader } from "@/components/ui/PageHeader";
import type { IntegrationOverviewItem } from "@/types/integrations";
import { IntegrationCatalogDialog } from "./IntegrationCatalogDialog";

export function IntegrationsPageHeader({
  canManage,
  availableProviders,
  agencySlug,
  storeSlug,
  demo = false,
}: {
  canManage: boolean;
  availableProviders: IntegrationOverviewItem[];
  agencySlug: string;
  storeSlug: string;
  demo?: boolean;
}) {
  const showAdd = canManage && availableProviders.length > 0;

  return (
    <PageHeader
      title="Integraciones"
      description="Conexiones mock de esta tienda y catálogo disponible."
      actions={
        <>
          {demo ? <DemoModeBadge /> : null}
          {showAdd ? (
            <IntegrationCatalogDialog
              availableProviders={availableProviders}
              agencySlug={agencySlug}
              storeSlug={storeSlug}
              demo={demo}
            />
          ) : null}
        </>
      }
    />
  );
}

export { BackToDashboardLink } from "@/components/layout/BackToDashboardLink";
