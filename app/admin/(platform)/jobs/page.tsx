import Link from "next/link";
import { Suspense } from "react";
import { JobActionsPanel } from "@/components/admin/AdminJobActions";
import { AdminJobsFiltersForm } from "@/components/admin/AdminOpsFilters";
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
import { JOB_STATUS_VALUES, labelJobStatus } from "@/lib/logistics/labels";
import { createClient } from "@/lib/supabase/server";
import { listJobs } from "@/services/jobs.service";
import type { Enums } from "@/types/database.generated";

function formatDate(value: string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("es-PE", { dateStyle: "short", timeStyle: "short" }).format(
    new Date(value),
  );
}

export default async function AdminJobsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParamsRecord>;
}) {
  const sp = await searchParams;
  const pagination = parsePaginationParams(sp, { pageSize: 25 });
  const status = parseEnumParam(sp, "status", JOB_STATUS_VALUES);
  const queue = parseStringParam(sp, "queue");
  const jobType = parseStringParam(sp, "job_type");
  const q = parseStringParam(sp, "q");

  let result;
  try {
    result = await listJobs(await createClient(), {
      page: pagination.page,
      pageSize: pagination.pageSize,
      status: status as Enums<"background_job_status"> | undefined,
      queue,
      jobType,
      search: q,
    });
  } catch {
    return (
      <div className="space-y-6">
        <PageHeader title="Tareas" description="Cola de trabajos en segundo plano." />
        <ErrorState title="Error al cargar tareas" description="Inténtalo de nuevo en unos momentos." />
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
    return `${routes.admin.jobs}?${params.toString()}`;
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Tareas"
        description={`${result.total} trabajo(s) en segundo plano.`}
      />
      <JobActionsPanel showProcessBatch />
      <Suspense fallback={<Skeleton className="h-28 w-full" />}>
        <AdminJobsFiltersForm initial={{ status, queue, jobType, q }} />
      </Suspense>
      {result.data.length === 0 ? (
        <EmptyState title="Sin tareas" description="No hay trabajos con los filtros actuales." />
      ) : (
        <div className="overflow-hidden rounded-lg border border-border">
          <DataTable
            data={result.data}
            getRowId={(row) => row.id}
            columns={[
              {
                id: "type",
                header: "Tipo",
                cell: (row) => (
                  <Link className="font-medium text-brand-primary hover:underline" href={routes.admin.jobDetail(row.id)}>
                    {row.job_type}
                  </Link>
                ),
              },
              {
                id: "status",
                header: "Estado",
                cell: (row) => <StatusBadge status={row.status} label={labelJobStatus(row.status)} />,
              },
              { id: "queue", header: "Cola", cell: (row) => row.queue },
              {
                id: "attempts",
                header: "Intentos",
                cell: (row) => `${row.attempts}/${row.max_attempts}`,
              },
              { id: "run_at", header: "Próximo", cell: (row) => formatDate(row.run_at) },
              { id: "created", header: "Creado", cell: (row) => formatDate(row.created_at) },
              {
                id: "error",
                header: "Error",
                cell: (row) => (
                  <span className="line-clamp-1 max-w-[14rem] text-xs text-text-secondary">
                    {row.last_error_message ?? "—"}
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
