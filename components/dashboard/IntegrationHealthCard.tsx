import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";
import { AlertTriangle, Check, PlugZap } from "lucide-react";
import { routes } from "@/config/routes";
import { cn } from "@/lib/utils/cn";
import type { DashboardIntegrationHealth } from "@/types/dashboard";

function syncLabel(lastSyncAt: string | null): string {
  if (!lastSyncAt) return "Sin sincronización";
  return formatDistanceToNow(new Date(lastSyncAt), { addSuffix: true, locale: es });
}

export function IntegrationHealthCard({
  health,
  agencySlug,
  storeSlug,
}: {
  health: DashboardIntegrationHealth;
  agencySlug: string;
  storeSlug: string;
}) {
  const href = routes.store.integrations(agencySlug, storeSlug);

  const copy =
    health.state === "empty"
      ? {
          title: "No hay integraciones conectadas",
          detail: "Conecta comercio, anuncios o logística para operar.",
          tone: "empty" as const,
        }
      : health.state === "error"
        ? {
            title: "Hay integraciones con error",
            detail: `${health.errorCount} con error · Última sincronización: ${syncLabel(health.lastSyncAt)}`,
            tone: "error" as const,
          }
        : health.state === "warning"
          ? {
              title: "Revisa el estado de tus conexiones",
              detail: `${health.activeCount}/${health.totalCount} activas · Última sincronización: ${syncLabel(health.lastSyncAt)}`,
              tone: "warning" as const,
            }
          : {
              title: "Todas las integraciones están activas",
              detail: `Última sincronización: ${syncLabel(health.lastSyncAt)}`,
              tone: "healthy" as const,
            };

  return (
    <article className="flex h-full min-h-[110px] flex-col rounded-[11px] border border-border bg-surface-elevated p-4 shadow-[var(--card-shadow)] sm:min-h-[115px] sm:p-4">
      <h2 className="text-[13px] font-semibold text-text-primary">Estado de integraciones</h2>
      <p className="mt-1 text-[12px] text-text-secondary">Conexiones registradas para esta tienda.</p>

      <div
        className={cn(
          "mt-3 flex flex-1 items-start gap-3 rounded-[10px] px-3 py-3",
          copy.tone === "healthy" && "bg-success-soft",
          copy.tone === "warning" && "bg-brand-softer",
          copy.tone === "error" && "bg-danger-soft",
          copy.tone === "empty" && "bg-muted",
        )}
      >
        <span
          className={cn(
            "grid size-8 shrink-0 place-items-center rounded-full",
            copy.tone === "healthy" && "bg-success text-white",
            copy.tone === "warning" && "bg-brand-primary text-white",
            copy.tone === "error" && "bg-danger text-white",
            copy.tone === "empty" && "bg-border text-text-secondary",
          )}
          aria-hidden
        >
          {copy.tone === "healthy" ? (
            <Check className="size-4" />
          ) : copy.tone === "empty" ? (
            <PlugZap className="size-4" />
          ) : (
            <AlertTriangle className="size-4" />
          )}
        </span>
        <div className="min-w-0">
          <p className="text-[13px] font-semibold text-text-primary">{copy.title}</p>
          <p className="mt-0.5 text-[12px] text-text-secondary">{copy.detail}</p>
        </div>
      </div>

      <div className="mt-3">
        <Link
          href={href}
          className="inline-flex h-9 items-center justify-center rounded-md border border-brand-primary px-3 text-[12.5px] font-medium text-brand-primary transition-colors hover:bg-brand-softer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          Ver integraciones
        </Link>
      </div>
    </article>
  );
}
