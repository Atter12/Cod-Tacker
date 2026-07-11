import Link from "next/link";
import {
  DataTable,
  EmptyState,
  ErrorState,
  SectionHeader,
  StatusBadge,
  DemoModeBadge,
} from "@/components/ui";
import { routes } from "@/config/routes";
import {
  parseEnumParam,
  parsePaginationParams,
  type SearchParamsRecord,
} from "@/lib/http/search-params";
import { labelAlertSeverity, labelAlertStatus } from "@/lib/alerts/labels";
import { can } from "@/lib/permissions/can";
import { createClient } from "@/lib/supabase/server";
import { requireStoreAccess } from "@/lib/tenant/require-store-access";
import { listAlertsPaginated } from "@/services/alerts.service";
import type { Enums } from "@/types/database.generated";

export default async function AlertsPage({
  params,
  searchParams,
}: {
  params: Promise<{ agencySlug: string; storeSlug: string }>;
  searchParams: Promise<SearchParamsRecord>;
}) {
  const p = await params;
  const sp = await searchParams;
  const member = await requireStoreAccess(p.agencySlug, p.storeSlug);
  if (!can(member.roles, "alerts.view")) {
    return <ErrorState title="Sin permiso" description="No puedes ver alertas." />;
  }
  if (!member.storeId) {
    return <ErrorState title="Tienda inválida" description="Tienda no resuelta." />;
  }

  const pagination = parsePaginationParams(sp, { pageSize: 25 });
  const severity = parseEnumParam(sp, "severity", ["info", "warning", "critical"]);
  const status = parseEnumParam(sp, "status", [
    "open",
    "acknowledged",
    "resolved",
    "silenced",
    "reopened",
  ]);

  const result = await listAlertsPaginated(await createClient(), {
    storeId: member.storeId,
    page: pagination.page,
    pageSize: pagination.pageSize,
    severities: severity ? [severity as Enums<"alert_severity">] : undefined,
    statuses: status ? [status] : undefined,
    includeResolved: status === "resolved",
  });

  return (
    <section className="space-y-5">
      <DemoModeBadge />
      <SectionHeader
        title="Alertas"
        description="Incidencias operativas: asignar, reconocer, resolver y silenciar."
      />
      {result.rows.length === 0 ? (
        <EmptyState title="Sin alertas" description="No hay alertas para los filtros actuales." />
      ) : (
        <DataTable
          data={result.rows}
          getRowId={(row) => row.id}
          columns={[
            {
              id: "title",
              header: "Alerta",
              cell: (row) => (
                <Link
                  className="underline text-brand-primary"
                  href={routes.store.alertDetail(p.agencySlug, p.storeSlug, row.id)}
                >
                  {row.title}
                </Link>
              ),
            },
            { id: "type", header: "Tipo", cell: (row) => row.type },
            {
              id: "sev",
              header: "Severidad",
              cell: (row) => (
                <StatusBadge status={row.severity} label={labelAlertSeverity(row.severity)} />
              ),
            },
            {
              id: "status",
              header: "Estado",
              cell: (row) => (
                <StatusBadge status={row.status} label={labelAlertStatus(row.status)} />
              ),
            },
            {
              id: "entity",
              header: "Entidad",
              cell: (row) =>
                row.order_id
                  ? `Pedido ${row.order_id.slice(0, 8)}`
                  : row.shipment_id
                    ? `Envío ${row.shipment_id.slice(0, 8)}`
                    : row.campaign_id
                      ? `Campaña ${row.campaign_id.slice(0, 8)}`
                      : "—",
            },
            {
              id: "date",
              header: "Fecha",
              cell: (row) => new Date(row.created_at).toLocaleString("es-PE"),
            },
          ]}
          emptyMessage="Sin alertas."
        />
      )}
      <p className="text-sm text-text-secondary">
        Página {result.page} · {result.total} alertas
      </p>
    </section>
  );
}
