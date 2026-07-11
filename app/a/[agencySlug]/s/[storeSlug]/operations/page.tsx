import Link from "next/link";
import {
  DataTable,
  DemoModeBadge,
  EmptyState,
  ErrorState,
  SectionHeader,
  StatusBadge,
} from "@/components/ui";
import { routes } from "@/config/routes";
import {
  getCatalogEntry,
  labelHealthStatus,
  labelIntegrationStatus,
  labelSyncStatus,
  labelSyncType,
} from "@/lib/integrations/catalog";
import { isDemoIntegrationMode } from "@/lib/integrations/registry";
import { can } from "@/lib/permissions/can";
import { createClient } from "@/lib/supabase/server";
import { requireStoreAccess } from "@/lib/tenant/require-store-access";
import {
  latestHealth,
  listIntegrations,
  listSyncRuns,
} from "@/services/integrations.service";

export default async function OperationsPage({
  params,
}: {
  params: Promise<{ agencySlug: string; storeSlug: string }>;
}) {
  const p = await params;
  const member = await requireStoreAccess(p.agencySlug, p.storeSlug);
  if (!can(member.roles, "operations.view") && !can(member.roles, "integrations.view")) {
    return <ErrorState title="Sin permiso" description="No puedes ver operaciones en esta tienda." />;
  }
  if (!member.storeId) {
    return <ErrorState title="Tienda inválida" description="No se pudo resolver la tienda activa." />;
  }

  const client = await createClient();
  let integrations;
  let syncRuns;
  try {
    integrations = await listIntegrations(client, member.agencyId, member.storeId);
    syncRuns = await listSyncRuns(client, member.agencyId, member.storeId, { limit: 30 });
  } catch {
    return <ErrorState title="Error al cargar operaciones" description="Inténtalo de nuevo en unos momentos." />;
  }

  const healthRows = await Promise.all(
    integrations.map(async (integration) => {
      const health = await latestHealth(client, member.agencyId, member.storeId!, integration.id);
      return { integration, health };
    }),
  );

  const completed = syncRuns.filter((run) => run.status === "completed").length;
  const failed = syncRuns.filter((run) => run.status === "failed").length;
  const running = syncRuns.filter((run) => run.status === "running" || run.status === "queued").length;
  const demo = isDemoIntegrationMode();

  return (
    <section className="space-y-5">
      <SectionHeader
        title="Operaciones"
        description="Salud de integraciones e historial reciente de sincronización."
        action={demo ? <DemoModeBadge /> : null}
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-lg border border-border bg-surface-elevated p-4">
          <p className="text-xs uppercase tracking-wide text-text-secondary">Completadas</p>
          <p className="mt-1 text-2xl font-semibold">{completed}</p>
        </div>
        <div className="rounded-lg border border-border bg-surface-elevated p-4">
          <p className="text-xs uppercase tracking-wide text-text-secondary">Fallidas</p>
          <p className="mt-1 text-2xl font-semibold">{failed}</p>
        </div>
        <div className="rounded-lg border border-border bg-surface-elevated p-4">
          <p className="text-xs uppercase tracking-wide text-text-secondary">En curso / cola</p>
          <p className="mt-1 text-2xl font-semibold">{running}</p>
        </div>
      </div>

      <div className="space-y-3">
        <SectionHeader title="Salud por proveedor" />
        {healthRows.length === 0 ? (
          <EmptyState
            title="Sin integraciones"
            description="Conecta un proveedor mock desde Integraciones para ver salud operativa."
          />
        ) : (
          <DataTable
            columns={[
              {
                id: "provider",
                header: "Proveedor",
                cell: (row) => {
                  const catalog = getCatalogEntry(row.integration.provider);
                  return (
                    <Link
                      href={routes.store.integrationDetail(
                        p.agencySlug,
                        p.storeSlug,
                        row.integration.provider,
                      )}
                      className="text-brand-primary hover:underline"
                    >
                      {row.integration.display_name || catalog?.name || row.integration.provider}
                    </Link>
                  );
                },
              },
              {
                id: "connection",
                header: "Conexión",
                cell: (row) => (
                  <StatusBadge
                    status={row.integration.status}
                    label={labelIntegrationStatus(row.integration.status)}
                  />
                ),
              },
              {
                id: "health",
                header: "Salud",
                cell: (row) =>
                  row.health ? (
                    <StatusBadge
                      status={row.health.status}
                      label={labelHealthStatus(row.health.status)}
                    />
                  ) : (
                    "—"
                  ),
              },
              {
                id: "latency",
                header: "Latencia",
                cell: (row) => (row.health?.latency_ms != null ? `${row.health.latency_ms} ms` : "—"),
              },
              {
                id: "checked",
                header: "Última prueba",
                cell: (row) =>
                  row.health ? new Date(row.health.checked_at).toLocaleString("es-PE") : "Sin pruebas",
              },
            ]}
            data={healthRows}
            getRowId={(row) => row.integration.id}
          />
        )}
      </div>

      <div className="space-y-3">
        <SectionHeader title="Últimas sincronizaciones" />
        <DataTable
          columns={[
            {
              id: "when",
              header: "Inicio",
              cell: (row) => new Date(row.created_at).toLocaleString("es-PE"),
            },
            {
              id: "provider",
              header: "Proveedor",
              cell: (row) => getCatalogEntry(row.provider)?.name ?? row.provider,
            },
            {
              id: "type",
              header: "Tipo",
              cell: (row) => labelSyncType(row.sync_type),
            },
            {
              id: "status",
              header: "Estado",
              cell: (row) => <StatusBadge status={row.status} label={labelSyncStatus(row.status)} />,
            },
            {
              id: "totals",
              header: "Recibidos",
              cell: (row) => String(row.received_total),
            },
            {
              id: "link",
              header: "",
              cell: (row) => (
                <Link
                  href={routes.store.syncRunDetail(p.agencySlug, p.storeSlug, row.id)}
                  className="text-sm text-brand-primary hover:underline"
                >
                  Detalle
                </Link>
              ),
            },
          ]}
          data={syncRuns}
          getRowId={(row) => row.id}
          emptyMessage="Aún no hay ejecuciones de sincronización."
        />
      </div>
    </section>
  );
}
