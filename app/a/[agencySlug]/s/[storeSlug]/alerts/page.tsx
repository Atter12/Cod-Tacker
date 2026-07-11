import Link from "next/link";
import { CheckCircle2 } from "lucide-react";
import { AlertCard } from "@/components/alerts/AlertCard";
import { ErrorState } from "@/components/ui";
import { routes } from "@/config/routes";
import {
  parseEnumParam,
  parsePaginationParams,
  type SearchParamsRecord,
} from "@/lib/http/search-params";
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

  const pagination = parsePaginationParams(sp, { pageSize: 10 });
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

  const totalPages = Math.max(1, Math.ceil(result.total / result.pageSize));

  function buildPageHref(page: number): string {
    const next = new URLSearchParams();
    for (const [key, value] of Object.entries(sp)) {
      const v = Array.isArray(value) ? value[0] : value;
      if (v) next.set(key, v);
    }
    next.set("page", String(page));
    return `${routes.store.alerts(p.agencySlug, p.storeSlug)}?${next.toString()}`;
  }

  return (
    <section className="space-y-5">
      <header>
        <h1 className="text-[24px] font-bold leading-[30px] tracking-tight text-text-primary">
          Alertas
        </h1>
        <p className="mt-0.5 text-[13px] text-text-secondary">
          Revisa tareas operativas que requieren atención.
        </p>
      </header>

      <div className="w-full max-w-[430px] space-y-5">
        {result.rows.length === 0 ? (
          <div className="flex flex-col items-start rounded-[10px] border border-border bg-surface-elevated px-5 py-10 shadow-[var(--card-shadow)]">
            <span className="grid size-12 place-items-center rounded-full bg-success-soft text-success">
              <CheckCircle2 className="size-6" aria-hidden />
            </span>
            <p className="mt-4 text-[14px] font-semibold text-text-primary">
              No hay alertas pendientes
            </p>
            <p className="mt-1 text-[12.5px] leading-relaxed text-text-secondary">
              Cuando surjan incidencias operativas aparecerán aquí para que puedas revisarlas.
            </p>
          </div>
        ) : (
          <ul className="space-y-3">
            {result.rows.map((alert) => (
              <li key={alert.id}>
                <AlertCard
                  alert={alert}
                  agencySlug={p.agencySlug}
                  storeSlug={p.storeSlug}
                />
              </li>
            ))}
          </ul>
        )}

        {result.total > 0 ? (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-[12.5px] text-text-secondary">
              {result.total.toLocaleString("es-PE")} alerta{result.total === 1 ? "" : "s"}
              {totalPages > 1 ? ` · Página ${result.page} de ${totalPages}` : null}
            </p>
            {totalPages > 1 ? (
              <nav aria-label="Paginación" className="flex gap-2 text-[12.5px]">
                {result.page > 1 ? (
                  <Link
                    className="rounded-md border border-border bg-surface-elevated px-3 py-1.5 hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    href={buildPageHref(result.page - 1)}
                  >
                    Anterior
                  </Link>
                ) : null}
                {result.page < totalPages ? (
                  <Link
                    className="rounded-md border border-border bg-surface-elevated px-3 py-1.5 hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    href={buildPageHref(result.page + 1)}
                  >
                    Siguiente
                  </Link>
                ) : null}
              </nav>
            ) : null}
          </div>
        ) : null}

        <div>
          <Link
            href={routes.store.dashboard(p.agencySlug, p.storeSlug)}
            className="inline-flex h-9 items-center justify-center rounded-md border border-brand-primary px-3.5 text-[12.5px] font-medium text-brand-primary transition-colors hover:bg-brand-softer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            Volver al resumen
          </Link>
        </div>
      </div>
    </section>
  );
}
