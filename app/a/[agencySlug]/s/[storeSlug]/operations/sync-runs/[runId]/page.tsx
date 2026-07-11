import Link from "next/link";
import {
  Alert,
  DataTable,
  DemoModeBadge,
  ErrorState,
  SectionHeader,
  StatusBadge,
} from "@/components/ui";
import { routes } from "@/config/routes";
import {
  getCatalogEntry,
  labelSyncStatus,
  labelSyncType,
} from "@/lib/integrations/catalog";
import { isDemoIntegrationMode } from "@/lib/integrations/registry";
import { can } from "@/lib/permissions/can";
import { createClient } from "@/lib/supabase/server";
import { requireStoreAccess } from "@/lib/tenant/require-store-access";
import { getSyncRun } from "@/services/integrations.service";

export default async function SyncRunDetailPage({
  params,
}: {
  params: Promise<{ agencySlug: string; storeSlug: string; runId: string }>;
}) {
  const p = await params;
  const member = await requireStoreAccess(p.agencySlug, p.storeSlug);
  if (!can(member.roles, "operations.view") && !can(member.roles, "integrations.view")) {
    return <ErrorState title="Sin permiso" description="No puedes ver esta ejecución." />;
  }
  if (!member.storeId) {
    return <ErrorState title="Tienda inválida" description="No se pudo resolver la tienda activa." />;
  }

  const detail = await getSyncRun(await createClient(), member.agencyId, member.storeId, p.runId);
  if (!detail) {
    return <ErrorState title="Ejecución no encontrada" description="No existe esta sincronización en la tienda." />;
  }

  const { run, items } = detail;
  const catalog = getCatalogEntry(run.provider);
  const demo = isDemoIntegrationMode() || Boolean((run.metadata as { demo?: boolean } | null)?.demo);

  return (
    <section className="space-y-5">
      <div className="space-y-2">
        <Link
          href={routes.store.operations(p.agencySlug, p.storeSlug)}
          className="text-sm text-brand-primary hover:underline"
        >
          ← Operaciones
        </Link>
        <SectionHeader
          title={`Sincronización · ${catalog?.name ?? run.provider}`}
          description={`${labelSyncType(run.sync_type)} · ${run.trigger_source}`}
          action={demo ? <DemoModeBadge /> : null}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-lg border border-border bg-surface-elevated p-4">
          <p className="text-xs uppercase tracking-wide text-text-secondary">Estado</p>
          <div className="mt-2">
            <StatusBadge status={run.status} label={labelSyncStatus(run.status)} />
          </div>
        </div>
        <div className="rounded-lg border border-border bg-surface-elevated p-4">
          <p className="text-xs uppercase tracking-wide text-text-secondary">Inicio</p>
          <p className="mt-2 text-sm">
            {run.started_at ? new Date(run.started_at).toLocaleString("es-PE") : "—"}
          </p>
        </div>
        <div className="rounded-lg border border-border bg-surface-elevated p-4">
          <p className="text-xs uppercase tracking-wide text-text-secondary">Fin</p>
          <p className="mt-2 text-sm">
            {run.finished_at ? new Date(run.finished_at).toLocaleString("es-PE") : "—"}
          </p>
        </div>
        <div className="rounded-lg border border-border bg-surface-elevated p-4">
          <p className="text-xs uppercase tracking-wide text-text-secondary">Totales</p>
          <p className="mt-2 text-sm">
            {run.received_total} recibidos · {run.created_total} creados · {run.updated_total} act. ·{" "}
            {run.skipped_total} omit. · {run.failed_total} fallos
          </p>
        </div>
      </div>

      {run.error_message ? (
        <Alert variant="danger" title={run.error_code ?? "Error"}>
          {run.error_message}
        </Alert>
      ) : null}

      <div className="flex flex-wrap gap-3 text-sm">
        <Link
          href={routes.store.integrationDetail(p.agencySlug, p.storeSlug, run.provider)}
          className="text-brand-primary hover:underline"
        >
          Ver integración
        </Link>
        {run.cursor_before || run.cursor_after ? (
          <span className="text-text-secondary">
            Cursor: {run.cursor_before ?? "—"} → {run.cursor_after ?? "—"}
          </span>
        ) : null}
      </div>

      <div className="space-y-3">
        <SectionHeader title="Ítems" description="Resultados por entidad de esta ejecución." />
        <DataTable
          columns={[
            { id: "entity", header: "Tipo", cell: (row) => row.entity_type },
            { id: "external", header: "ID externo", cell: (row) => row.external_id ?? "—" },
            {
              id: "status",
              header: "Estado",
              cell: (row) => <StatusBadge status={row.status} label={row.status} />,
            },
            { id: "action", header: "Acción", cell: (row) => row.action ?? "—" },
            { id: "error", header: "Error", cell: (row) => row.error ?? "—" },
          ]}
          data={items}
          getRowId={(row) => row.id}
          emptyMessage="Esta ejecución no registró ítems detallados."
        />
      </div>
    </section>
  );
}
