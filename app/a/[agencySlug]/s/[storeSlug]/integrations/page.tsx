import {
  DemoModeBadge,
  EmptyState,
  ErrorState,
  IntegrationCard,
  SectionHeader,
} from "@/components/ui";
import { routes } from "@/config/routes";
import { INTEGRATION_CATALOG, labelIntegrationStatus } from "@/lib/integrations/catalog";
import { isDemoIntegrationMode } from "@/lib/integrations/registry";
import { can } from "@/lib/permissions/can";
import { createClient } from "@/lib/supabase/server";
import { requireStoreAccess } from "@/lib/tenant/require-store-access";
import { listIntegrations } from "@/services/integrations.service";

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

  let rows;
  try {
    rows = await listIntegrations(await createClient(), member.agencyId, member.storeId);
  } catch {
    return (
      <ErrorState title="Error al cargar integraciones" description="Inténtalo de nuevo en unos momentos." />
    );
  }

  const demo = isDemoIntegrationMode();
  const connectedProviders = new Set(rows.map((row) => row.provider));

  return (
    <section className="space-y-5">
      <SectionHeader
        title="Integraciones"
        description="Conexiones mock de esta tienda. El estado conectado proviene de la base de datos."
        action={demo ? <DemoModeBadge /> : null}
      />

      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-text-secondary">Conectadas</h3>
        {rows.length === 0 ? (
          <EmptyState
            title="Sin integraciones conectadas"
            description="Conecta un proveedor mock desde el catálogo para empezar."
          />
        ) : (
          <div className="grid gap-4 lg:grid-cols-2">
            {rows.map((row) => {
              const catalog = INTEGRATION_CATALOG.find((entry) => entry.provider === row.provider);
              return (
                <IntegrationCard
                  key={row.id}
                  name={row.display_name || catalog?.name || row.provider}
                  description={catalog?.description ?? "Integración de la tienda."}
                  status={row.status}
                  statusLabel={labelIntegrationStatus(row.status)}
                  demo={demo || Boolean((row.metadata as { demo?: boolean } | null)?.demo)}
                  href={routes.store.integrationDetail(p.agencySlug, p.storeSlug, row.provider)}
                  actionLabel="Revisar"
                />
              );
            })}
          </div>
        )}
      </div>

      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-text-secondary">Catálogo disponible</h3>
        <div className="grid gap-4 lg:grid-cols-2">
          {INTEGRATION_CATALOG.filter((entry) => !connectedProviders.has(entry.provider)).map((entry) => (
            <IntegrationCard
              key={entry.provider}
              name={entry.name}
              description={entry.description}
              status="disconnected"
              statusLabel="No conectado"
              demo={demo}
              href={routes.store.integrationDetail(p.agencySlug, p.storeSlug, entry.provider)}
              actionLabel="Conectar"
            />
          ))}
        </div>
      </div>
    </section>
  );
}
