import { PlugZap } from "lucide-react";
import type { IntegrationOverviewItem } from "@/types/integrations";
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
    <div className="w-full max-w-[680px] rounded-[10px] border border-border bg-surface-elevated px-7 py-8 shadow-[var(--card-shadow)] sm:px-8">
      <span
        className="grid size-[48px] place-items-center rounded-full bg-brand-soft text-brand-primary"
        aria-hidden
      >
        <PlugZap className="size-5" />
      </span>
      <h2 className="mt-4 text-[15px] font-semibold text-text-primary">
        Aún no hay integraciones conectadas
      </h2>
      <p className="mt-1.5 max-w-md text-[13px] leading-relaxed text-text-secondary">
        Conecta tu tienda, plataformas publicitarias o servicios logísticos para empezar a
        sincronizar información.
      </p>
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
    </div>
  );
}
