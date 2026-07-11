import { BackToDashboardLink } from "@/components/layout/BackToDashboardLink";
import { IntegrationCatalogGrid } from "@/components/integrations/IntegrationCatalogGrid";
import { IntegrationsEmptyState } from "@/components/integrations/IntegrationsEmptyState";
import { IntegrationsGrid } from "@/components/integrations/IntegrationsGrid";
import { IntegrationsLoadError } from "@/components/integrations/IntegrationsLoadError";
import { IntegrationsPageHeader } from "@/components/integrations/IntegrationsPageHeader";
import { ErrorState, SectionHeader } from "@/components/ui";
import {
  isAvailableCatalogItem,
  isConfiguredOverviewItem,
} from "@/lib/integrations/overview";
import { isDemoIntegrationMode } from "@/lib/integrations/registry";
import { can } from "@/lib/permissions/can";
import { logger } from "@/lib/observability/logger";
import { createClient } from "@/lib/supabase/server";
import { requireStoreAccess } from "@/lib/tenant/require-store-access";
import { listIntegrationOverviews } from "@/services/integrations.service";

export default async function IntegrationsPage({
  params,
}: {
  params: Promise<{ agencySlug: string; storeSlug: string }>;
}) {
  const p = await params;
  const member = await requireStoreAccess(p.agencySlug, p.storeSlug);
  if (!can(member.roles, "integrations.view")) {
    return <ErrorState title="Sin permiso" description="No puedes ver integraciones en esta tienda." />;
  }
  if (!member.storeId) {
    return <ErrorState title="Tienda inválida" description="No se pudo resolver la tienda activa." />;
  }

  const canManage = can(member.roles, "integrations.manage");
  const demo = isDemoIntegrationMode();
  const client = await createClient();

  const storeResult = await client
    .from("stores")
    .select("timezone")
    .eq("id", member.storeId)
    .eq("agency_id", member.agencyId)
    .maybeSingle();
  const timeZone = storeResult.data?.timezone?.trim() || "America/Lima";

  let items;
  try {
    items = await listIntegrationOverviews(client, member.agencyId, member.storeId, {
      timeZone,
    });
  } catch (error) {
    logger.error("integrations.overview.load_failed", {
      agencyId: member.agencyId,
      storeId: member.storeId,
      message: error instanceof Error ? error.message : "unknown",
    });
    return (
      <section className="space-y-6">
        <IntegrationsPageHeader
          canManage={false}
          availableProviders={[]}
          agencySlug={p.agencySlug}
          storeSlug={p.storeSlug}
          demo={demo}
        />
        <IntegrationsLoadError />
        <BackToDashboardLink agencySlug={p.agencySlug} storeSlug={p.storeSlug} />
      </section>
    );
  }

  const configuredItems = items.filter(isConfiguredOverviewItem);
  const availableProviders = items.filter(isAvailableCatalogItem);

  return (
    <section className="space-y-8">
      <IntegrationsPageHeader
        canManage={canManage}
        availableProviders={availableProviders}
        agencySlug={p.agencySlug}
        storeSlug={p.storeSlug}
        demo={demo}
      />

      <div className="space-y-4">
        <SectionHeader title="Conectadas" />
        {configuredItems.length > 0 ? (
          <IntegrationsGrid
            items={configuredItems}
            agencySlug={p.agencySlug}
            storeSlug={p.storeSlug}
          />
        ) : (
          <IntegrationsEmptyState
            canManage={canManage}
            availableProviders={availableProviders}
            agencySlug={p.agencySlug}
            storeSlug={p.storeSlug}
            demo={demo}
          />
        )}
      </div>

      {availableProviders.length > 0 ? (
        <div className="space-y-4">
          <SectionHeader
            title="Catálogo disponible"
            description="Proveedores listos para conectar en esta tienda."
          />
          <IntegrationCatalogGrid
            items={availableProviders}
            agencySlug={p.agencySlug}
            storeSlug={p.storeSlug}
            canManage={canManage}
            demo={demo}
          />
        </div>
      ) : null}

      <BackToDashboardLink agencySlug={p.agencySlug} storeSlug={p.storeSlug} />
    </section>
  );
}
