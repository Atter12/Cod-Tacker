import Link from "next/link";
import { Suspense } from "react";
import { AdminDeadLetterFiltersForm } from "@/components/admin/AdminOpsFilters";
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
  type SearchParamsRecord,
} from "@/lib/http/search-params";
import { labelEventStatus, labelJobStatus } from "@/lib/logistics/labels";
import { createClient } from "@/lib/supabase/server";
import { listDeadLetter } from "@/services/jobs.service";

const KIND_VALUES = ["all", "job", "event"] as const;

function formatDate(value: string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("es-PE", { dateStyle: "short", timeStyle: "short" }).format(
    new Date(value),
  );
}

export default async function AdminDeadLetterPage({
  searchParams,
}: {
  searchParams: Promise<SearchParamsRecord>;
}) {
  const sp = await searchParams;
  const pagination = parsePaginationParams(sp, { pageSize: 25 });
  const kind = parseEnumParam(sp, "kind", KIND_VALUES) ?? "all";

  let result;
  try {
    result = await listDeadLetter(await createClient(), {
      page: pagination.page,
      pageSize: pagination.pageSize,
      kind,
    });
  } catch {
    return (
      <div className="space-y-6">
        <PageHeader title="Cola de errores" description="Trabajos y eventos en dead_letter." />
        <ErrorState title="Error al cargar cola de errores" description="Inténtalo de nuevo en unos momentos." />
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
    return `${routes.admin.deadLetter}?${params.toString()}`;
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Cola de errores" description={`${result.total} elemento(s) en dead_letter.`} />
      <Suspense fallback={<Skeleton className="h-20 w-full" />}>
        <AdminDeadLetterFiltersForm initial={{ kind }} />
      </Suspense>
      {result.data.length === 0 ? (
        <EmptyState
          title="Cola vacía"
          description="No hay trabajos ni eventos en estado dead_letter."
        />
      ) : (
        <div className="overflow-hidden rounded-lg border border-border">
          <DataTable
            data={result.data}
            getRowId={(row) => `${row.kind}:${row.id}`}
            columns={[
              {
                id: "kind",
                header: "Tipo",
                cell: (row) => (row.kind === "job" ? "Trabajo" : "Evento"),
              },
              {
                id: "name",
                header: "Nombre",
                cell: (row) => {
                  const label =
                    row.kind === "job" ? row.row.job_type : `${row.row.provider}/${row.row.event_type}`;
                  return (
                    <Link
                      className="font-medium text-brand-primary hover:underline"
                      href={`${routes.admin.deadLetterDetail(row.id)}?kind=${row.kind}`}
                    >
                      {label}
                    </Link>
                  );
                },
              },
              {
                id: "status",
                header: "Estado",
                cell: (row) =>
                  row.kind === "job" ? (
                    <StatusBadge status={row.row.status} label={labelJobStatus(row.row.status)} />
                  ) : (
                    <StatusBadge status={row.row.status} label={labelEventStatus(row.row.status)} />
                  ),
              },
              {
                id: "error",
                header: "Error",
                cell: (row) => (
                  <span className="line-clamp-1 max-w-[16rem] text-xs text-text-secondary">
                    {row.kind === "job"
                      ? (row.row.last_error_message ?? "—")
                      : (row.row.last_error ?? "—")}
                  </span>
                ),
              },
              { id: "when", header: "Fecha", cell: (row) => formatDate(row.createdAt) },
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
