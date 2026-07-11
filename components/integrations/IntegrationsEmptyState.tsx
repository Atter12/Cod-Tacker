import { Cable } from "lucide-react";
import type { IntegrationOverviewItem } from "@/types/integrations";
import { EmptyState } from "@/components/ui/EmptyState";
import { IntegrationCatalogDialog } from "./IntegrationCatalogDialog";

export function IntegrationsEmptyState({
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
  return (
    <EmptyState
      icon={
        <span className="grid size-12 place-items-center rounded-full bg-brand-soft text-brand-primary">
          <Cable className="size-6" aria-hidden />
        </span>
      }
      title="Sin integraciones conectadas"
      description="Conecta tu tienda, plataformas publicitarias o servicios logísticos para empezar a sincronizar información."
      className="min-h-[220px] border-solid py-14"
    >
      {canManage && availableProviders.length > 0 ? (
        <div className="mt-5">
          <IntegrationCatalogDialog
            availableProviders={availableProviders}
            agencySlug={agencySlug}
            storeSlug={storeSlug}
            demo={demo}
          />
        </div>
      ) : null}
      {!canManage ? (
        <p className="mt-3 text-[12.5px] text-text-secondary">
          Solicita a un administrador que configure una integración.
        </p>
      ) : null}
    </EmptyState>
  );
}
