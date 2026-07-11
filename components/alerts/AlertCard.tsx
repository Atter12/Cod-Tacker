import Link from "next/link";
import { AlertTriangle, Info, TriangleAlert } from "lucide-react";
import { routes } from "@/config/routes";
import { cn } from "@/lib/utils/cn";
import type { AlertRow } from "@/types/database";

function severityVisual(severity: AlertRow["severity"]): {
  icon: typeof Info;
  iconClass: string;
  ringClass: string;
} {
  switch (severity) {
    case "critical":
      return {
        icon: TriangleAlert,
        iconClass: "bg-danger-soft text-danger",
        ringClass: "border-danger/25 hover:border-danger/40",
      };
    case "warning":
      return {
        icon: AlertTriangle,
        iconClass: "bg-brand-softer text-brand-primary",
        ringClass: "border-brand-primary/20 hover:border-brand-primary/35",
      };
    case "info":
    default:
      return {
        icon: Info,
        iconClass: "bg-muted text-text-secondary",
        ringClass: "border-border hover:border-brand-primary/25",
      };
  }
}

function alertDescription(alert: AlertRow): string {
  const body = alert.body?.trim();
  if (body) return body;
  if (alert.order_id) return "Revisa el pedido asociado y toma una acción.";
  if (alert.shipment_id) return "Hay una incidencia logística pendiente de revisión.";
  if (alert.campaign_id) return "La campaña requiere atención operativa.";
  return "Abre el detalle para revisar y resolver esta alerta.";
}

export function AlertCard({
  alert,
  agencySlug,
  storeSlug,
}: {
  alert: AlertRow;
  agencySlug: string;
  storeSlug: string;
}) {
  const visual = severityVisual(alert.severity);
  const Icon = visual.icon;
  const href = routes.store.alertDetail(agencySlug, storeSlug, alert.id);
  const description = alertDescription(alert);

  return (
    <Link
      href={href}
      aria-label={`${alert.title}. ${description}`}
      className={cn(
        "flex items-start gap-3.5 rounded-[10px] border bg-surface-elevated p-4 shadow-[var(--card-shadow)] transition-colors",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        visual.ringClass,
      )}
    >
      <span
        className={cn("mt-0.5 grid size-10 shrink-0 place-items-center rounded-full", visual.iconClass)}
        aria-hidden
      >
        <Icon className="size-[18px]" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[14px] font-semibold leading-snug text-text-primary">
          {alert.title}
        </span>
        <span className="mt-1 line-clamp-2 block text-[12.5px] leading-relaxed text-text-secondary">
          {description}
        </span>
      </span>
    </Link>
  );
}
