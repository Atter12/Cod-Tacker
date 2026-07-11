import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { routes } from "@/config/routes";
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
    <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-[22px] font-bold leading-[30px] tracking-tight text-text-primary md:text-[24px]">
            Integraciones
          </h1>
          {demo ? (
            <span className="rounded-md bg-warning/10 px-1.5 py-0.5 text-[10px] font-medium text-warning">
              Entorno de demostración
            </span>
          ) : null}
        </div>
        <p className="mt-0.5 text-[12.5px] text-text-secondary md:text-[13px]">
          Conecta canales, pasarelas y herramientas operativas.
        </p>
      </div>
      {showAdd ? (
        <div className="shrink-0">
          <IntegrationCatalogDialog
            availableProviders={availableProviders}
            agencySlug={agencySlug}
            storeSlug={storeSlug}
            demo={demo}
          />
        </div>
      ) : null}
    </header>
  );
}

export function BackToDashboardLink({
  agencySlug,
  storeSlug,
}: {
  agencySlug: string;
  storeSlug: string;
}) {
  return (
    <div className="mt-14">
      <Link
        href={routes.store.dashboard(agencySlug, storeSlug)}
        className="inline-flex h-[34px] w-full items-center justify-center gap-1.5 rounded-[7px] border border-brand-primary bg-transparent px-5 text-[12px] font-medium text-brand-primary transition-colors hover:bg-brand-softer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:w-auto sm:min-w-[136px]"
      >
        <ArrowLeft className="size-3.5" aria-hidden />
        Volver al resumen
      </Link>
    </div>
  );
}
