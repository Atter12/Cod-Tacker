import Link from "next/link";
import { Activity, AlertTriangle, Cable, CheckCircle2 } from "lucide-react";
import { BackToDashboardLink } from "@/components/layout/BackToDashboardLink";
import { OperationsKpiCard } from "@/components/operations/OperationsKpiCard";
import {
  Card,
  CardContent,
  DataTable,
  DemoModeBadge,
  EmptyState,
  ErrorState,
  PageHeader,
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
    return (
      <ErrorState
        title="Error al cargar operaciones"
        description="Inténtalo de nuevo en unos momentos."
      />
    );
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
    <section className="space-y-8">
      <PageHeader
        title="Operaciones"
        description="Salud de integraciones e historial reciente de sincronización."
        actions={demo ? <DemoModeBadge /> : null}
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <OperationsKpiCard
          label="Completadas"
          value={completed}
          hint="Últimas sincronizaciones"
          icon={CheckCircle2}
          tone="success"
        />
        <OperationsKpiCard
          label="Fallidas"
          value={failed}
          hint="Requieren atención"
          icon={AlertTriangle}
          tone="danger"
        />
        <OperationsKpiCard
          label="En curso / cola"
          value={running}
          hint="Jobs activos"
          icon={Activity}
          tone="brand"
        />
      </div>

      <div className="space-y-4">
        <SectionHeader title="Salud por proveedor" />
        {healthRows.length === 0 ? (
          <EmptyState
            icon={
              <span className="grid size-12 place-items-center rounded-full bg-brand-soft text-brand-primary">
                <Cable className="size-6" aria-hidden />
              </span>
            }
            title="Sin integraciones"
            description="Conecta un proveedor mock desde Integraciones para ver salud operativa."
            className="min-h-[200px] border-solid"
          />
        ) : (
          <Card>
            <CardContent className="p-0 sm:p-0">
              <div className="overflow-x-auto">
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
                            className="font-medium text-brand-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
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
                      cell: (row) =>
                        row.health?.latency_ms != null ? `${row.health.latency_ms} ms` : "—",
                    },
                    {
                      id: "checked",
                      header: "Última prueba",
                      cell: (row) =>
                        row.health
                          ? new Date(row.health.checked_at).toLocaleString("es-PE")
                          : "Sin pruebas",
                    },
                  ]}
                  data={healthRows}
                  getRowId={(row) => row.integration.id}
                />
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      <div className="space-y-4">
        <SectionHeader title="Últimas sincronizaciones" />
        <Card>
          <CardContent className="p-0 sm:p-0">
            <div className="overflow-x-auto">
              <DataTable
                columns={[
                  {
                    id: "when",
                    header: "Inicio",
                    cell: (row) => (
                      <span className="whitespace-nowrap">
                        {new Date(row.created_at).toLocaleString("es-PE")}
                      </span>
                    ),
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
                    cell: (row) => (
                      <StatusBadge status={row.status} label={labelSyncStatus(row.status)} />
                    ),
                  },
                  {
                    id: "totals",
                    header: "Recibidos",
                    cell: (row) => (
                      <span className="tabular-nums">{row.received_total}</span>
                    ),
                  },
                  {
                    id: "link",
                    header: "Detalle",
                    cell: (row) => (
                      <Link
                        href={routes.store.syncRunDetail(p.agencySlug, p.storeSlug, row.id)}
                        className="text-[13px] font-medium text-brand-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
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
          </CardContent>
        </Card>
      </div>

      <BackToDashboardLink agencySlug={p.agencySlug} storeSlug={p.storeSlug} />
    </section>
  );
}
