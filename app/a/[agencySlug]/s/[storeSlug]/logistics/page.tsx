import Link from "next/link";
import { Suspense } from "react";
import { LogisticsFiltersForm } from "@/components/logistics/LogisticsFiltersForm";
import {
  isLogisticsEventStale,
  LogisticsLatencyNotice,
} from "@/components/logistics/LogisticsLatencyNotice";
import {
  DataTable,
  EmptyState,
  ErrorState,
  SectionHeader,
  Skeleton,
  StatusBadge,
} from "@/components/ui";
import { routes } from "@/config/routes";
import {
  parseBooleanParam,
  parseDateParam,
  parseEnumParam,
  parsePaginationParams,
  parseStringParam,
  type SearchParamsRecord,
} from "@/lib/http/search-params";
import { labelShipmentStatus, SHIPMENT_STATUS_OPTIONS } from "@/lib/logistics/labels";
import { can } from "@/lib/permissions/can";
import { createClient } from "@/lib/supabase/server";
import { requireStoreAccess } from "@/lib/tenant/require-store-access";
import { listShipmentsPaginated } from "@/services/shipments.service";
import type { Enums } from "@/types/database.generated";

function formatDate(value: string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("es-PE", { dateStyle: "short", timeStyle: "short" }).format(
    new Date(value),
  );
}

function freshnessLabel(lastEventAt: string | null): string {
  if (!lastEventAt) return "Sin señal";
  if (isLogisticsEventStale(lastEventAt)) {
    const ageMs = Date.now() - Date.parse(lastEventAt);
    if (!Number.isFinite(ageMs)) return "Sin señal";
    const days = Math.max(1, Math.floor(ageMs / 86_400_000));
    return `Sin señal · ${days} d`;
  }
  const ageMs = Date.now() - Date.parse(lastEventAt);
  const hours = ageMs / 3_600_000;
  if (hours < 1) return "Hace minutos";
  return `Hace ${Math.floor(hours)} h`;
}

export default async function LogisticsPage({
  params,
  searchParams,
}: {
  params: Promise<{ agencySlug: string; storeSlug: string }>;
  searchParams: Promise<SearchParamsRecord>;
}) {
  const p = await params;
  const sp = await searchParams;
  const member = await requireStoreAccess(p.agencySlug, p.storeSlug);
  if (!can(member.roles, "shipments.view") && !can(member.roles, "orders.view")) {
    return <ErrorState title="Sin permiso" description="No puedes ver logística en esta tienda." />;
  }
  if (!member.storeId) {
    return <ErrorState title="Tienda inválida" description="No se pudo resolver la tienda activa." />;
  }

  const pagination = parsePaginationParams(sp, { pageSize: 25 });
  const statusValues = SHIPMENT_STATUS_OPTIONS.map((o) => o.value);
  const status = parseEnumParam(sp, "status", statusValues);
  const q = parseStringParam(sp, "q");
  const rto = parseBooleanParam(sp, "rto");
  const terminal = parseBooleanParam(sp, "terminal");
  const from = parseDateParam(sp, "from");
  const to = parseDateParam(sp, "to");

  let result;
  try {
    result = await listShipmentsPaginated(await createClient(), {
      storeId: member.storeId,
      page: pagination.page,
      pageSize: pagination.pageSize,
      statuses: status ? [status as Enums<"shipment_status">] : undefined,
      search: q,
      isRto: rto,
      isTerminal: terminal,
      from: from ? new Date(from).toISOString() : undefined,
      to: to ? new Date(`${to}T23:59:59.999`).toISOString() : undefined,
    });
  } catch {
    return <ErrorState title="Error al cargar envíos" description="Inténtalo de nuevo en unos momentos." />;
  }

  const totalPages = Math.max(1, Math.ceil(result.total / result.pageSize));
  const filtersActive = Boolean(status || q || rto != null || terminal != null || from || to);
  const integrationsHref = routes.store.integrations(p.agencySlug, p.storeSlug);
  const staleCount = result.data.filter((row) => isLogisticsEventStale(row.last_event_at)).length;
  const buildPageHref = (page: number) => {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(sp)) {
      const v = Array.isArray(value) ? value[0] : value;
      if (v) params.set(key, v);
    }
    params.set("page", String(page));
    return `${routes.store.logistics(p.agencySlug, p.storeSlug)}?${params.toString()}`;
  };

  return (
    <section className="space-y-5">
      <SectionHeader
        title="Logística"
        description={`${result.total} envío(s) en la tienda. Conecta Envia.com (u otro courier) en Integraciones para sincronizar guías.`}
      />
      {result.data.length === 0 ? (
        <LogisticsLatencyNotice mode="empty" />
      ) : staleCount > 0 ? (
        <LogisticsLatencyNotice
          mode="stale"
          staleCount={staleCount}
          totalCount={result.data.length}
        />
      ) : (
        <LogisticsLatencyNotice mode="general" />
      )}
      <Suspense fallback={<Skeleton className="h-32 w-full" />}>
        <LogisticsFiltersForm
          initial={{
            q,
            status,
            rto: rto == null ? undefined : rto ? "1" : "0",
            terminal: terminal == null ? undefined : terminal ? "1" : "0",
            from,
            to,
          }}
        />
      </Suspense>
      {result.data.length === 0 ? (
        filtersActive ? (
          <EmptyState
            title="Sin envíos"
            description="No hay envíos con los filtros actuales. Prueba limpiar o ampliar el rango."
          />
        ) : (
          <EmptyState
            title="Aún no hay envíos"
            description="Conecta Envia.com u otro courier en Integraciones para sincronizar guías y el embudo de entrega / RTO."
            action={{ label: "Ir a Integraciones", href: integrationsHref }}
          />
        )
      ) : (
        <div className="overflow-hidden rounded-lg border border-border">
          <DataTable
            data={result.data}
            getRowId={(row) => row.id}
            columns={[
              {
                id: "tracking",
                header: "Guía",
                cell: (row) => (
                  <Link
                    className="font-medium text-brand-primary hover:underline"
                    href={routes.store.shipmentDetail(p.agencySlug, p.storeSlug, row.id)}
                  >
                    {row.tracking_number ?? row.id.slice(0, 8)}
                  </Link>
                ),
              },
              {
                id: "status",
                header: "Estado",
                cell: (row) => (
                  <StatusBadge status={row.status} label={labelShipmentStatus(row.status)} />
                ),
              },
              {
                id: "cierre",
                header: "Cierre",
                cell: (row) =>
                  row.is_terminal ? (
                    <StatusBadge status="delivered" label="Confirmado" />
                  ) : (
                    <StatusBadge status="pending" label="En curso" />
                  ),
              },
              {
                id: "rto",
                header: "RTO",
                cell: (row) => (row.is_rto ? "Sí" : "No"),
              },
              {
                id: "freshness",
                header: "Frescura",
                cell: (row) => freshnessLabel(row.last_event_at),
              },
              {
                id: "order",
                header: "Pedido",
                cell: (row) => (
                  <Link
                    className="text-brand-primary hover:underline"
                    href={routes.store.orderDetail(p.agencySlug, p.storeSlug, row.order_id)}
                  >
                    Ver pedido
                  </Link>
                ),
              },
              {
                id: "updated",
                header: "Último evento",
                cell: (row) => formatDate(row.last_event_at),
              },
            ]}
          />
        </div>
      )}
      {totalPages > 1 ? (
        <div className="flex items-center justify-between text-sm text-text-secondary">
          <span>
            Página {result.page} de {totalPages}
          </span>
          <div className="flex gap-2">
            {result.page > 1 ? (
              <Link className="text-brand-primary hover:underline" href={buildPageHref(result.page - 1)}>
                Anterior
              </Link>
            ) : null}
            {result.page < totalPages ? (
              <Link className="text-brand-primary hover:underline" href={buildPageHref(result.page + 1)}>
                Siguiente
              </Link>
            ) : null}
          </div>
        </div>
      ) : null}
    </section>
  );
}
