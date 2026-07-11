import Link from "next/link";
import { Suspense } from "react";
import { AdminWebhooksFiltersForm } from "@/components/admin/AdminOpsFilters";
import {
  DataTable,
  EmptyState,
  ErrorState,
  PageHeader,
  Skeleton,
  StatusBadge,
} from "@/components/ui";
import { routes } from "@/config/routes";
import {
  parseEnumParam,
  parsePaginationParams,
  parseStringParam,
  type SearchParamsRecord,
} from "@/lib/http/search-params";
import { EVENT_STATUS_VALUES, labelEventStatus } from "@/lib/logistics/labels";
import { createClient } from "@/lib/supabase/server";
import { listRawEvents } from "@/services/jobs.service";
import type { Enums } from "@/types/database.generated";

function formatDate(value: string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("es-PE", { dateStyle: "short", timeStyle: "short" }).format(
    new Date(value),
  );
}

export default async function AdminWebhooksPage({
  searchParams,
}: {
  searchParams: Promise<SearchParamsRecord>;
}) {
  const sp = await searchParams;
  const pagination = parsePaginationParams(sp, { pageSize: 25 });
  const status = parseEnumParam(sp, "status", EVENT_STATUS_VALUES);
  const provider = parseStringParam(sp, "provider");
  const eventType = parseStringParam(sp, "event_type");
  const q = parseStringParam(sp, "q");

  let result;
  try {
    result = await listRawEvents(await createClient(), {
      page: pagination.page,
      pageSize: pagination.pageSize,
      status: status as Enums<"event_status"> | undefined,
      provider,
      eventType,
      search: q,
    });
  } catch {
    return (
      <div className="space-y-6">
        <PageHeader title="Webhooks" description="Bandeja de eventos crudos (raw_events)." />
        <ErrorState title="Error al cargar eventos" description="Inténtalo de nuevo en unos momentos." />
      </div>
    );
  }

  const totalPages = Math.max(1, Math.ceil(result.total / result.pageSize));
  const buildPageHref = (page: number) => {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(sp)) {
      const v = Array.isArray(value) ? value[0] : value;
      if (v) params.set(key, v);
    }
    params.set("page", String(page));
    return `${routes.admin.webhooks}?${params.toString()}`;
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Webhooks" description={`${result.total} evento(s) crudo(s).`} />
      <Suspense fallback={<Skeleton className="h-28 w-full" />}>
        <AdminWebhooksFiltersForm initial={{ status, provider, eventType, q }} />
      </Suspense>
      {result.data.length === 0 ? (
        <EmptyState title="Sin eventos" description="No hay webhooks/eventos con los filtros actuales." />
      ) : (
        <div className="overflow-hidden rounded-lg border border-border">
          <DataTable
            data={result.data}
            getRowId={(row) => row.id}
            columns={[
              {
                id: "type",
                header: "Evento",
                cell: (row) => (
                  <Link
                    className="font-medium text-brand-primary hover:underline"
                    href={routes.admin.webhookDetail(row.id)}
                  >
                    {row.event_type}
                  </Link>
                ),
              },
              { id: "provider", header: "Proveedor", cell: (row) => row.provider },
              {
                id: "status",
                header: "Estado",
                cell: (row) => <StatusBadge status={row.status} label={labelEventStatus(row.status)} />,
              },
              {
                id: "attempts",
                header: "Intentos",
                cell: (row) => `${row.attempts}/${row.max_attempts}`,
              },
              { id: "received", header: "Recibido", cell: (row) => formatDate(row.received_at) },
              {
                id: "error",
                header: "Error",
                cell: (row) => (
                  <span className="line-clamp-1 max-w-[14rem] text-xs text-text-secondary">
                    {row.last_error ?? "—"}
                  </span>
                ),
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
    </div>
  );
}
