"use client";

import { ChevronRight, MapPin } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import type { FlipyRouteCardStatus, FlipyRoutePoint } from "@/lib/integrations/flipy/route-address";
import {
  formatFlipyRouteContactLine,
  getFlipyRouteCardStatus,
  hasFlipyRouteLocation,
} from "@/lib/integrations/flipy/route-address";

type Props = {
  label: string;
  emptyHint: string;
  point: FlipyRoutePoint;
  error?: string | null;
  requireEmail?: boolean;
  onPress: () => void;
};

const STATUS_STYLES: Record<
  FlipyRouteCardStatus,
  { border: string; bg: string; badge: string; badgeText: string }
> = {
  empty: {
    border: "border-red-200 dark:border-red-900/50",
    bg: "bg-red-50/60 dark:bg-red-950/20",
    badge: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300",
    badgeText: "Pendiente",
  },
  partial: {
    border: "border-amber-200 dark:border-amber-900/50",
    bg: "bg-amber-50/60 dark:bg-amber-950/20",
    badge: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
    badgeText: "Incompleto",
  },
  saved: {
    border: "border-emerald-200 dark:border-emerald-900/50",
    bg: "bg-emerald-50/50 dark:bg-emerald-950/20",
    badge: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300",
    badgeText: "Listo",
  },
};

export function FlipyRouteAddressCard({
  label,
  emptyHint,
  point,
  error,
  requireEmail,
  onPress,
}: Props) {
  const status = getFlipyRouteCardStatus(point, { requireEmail });
  const styles = STATUS_STYLES[status];
  const contactLine = formatFlipyRouteContactLine(point);
  const hasLocation = hasFlipyRouteLocation(point);

  return (
    <button
      type="button"
      onClick={onPress}
      className={cn(
        "flex w-full items-start gap-3 rounded-xl border p-4 text-left transition-colors",
        "hover:brightness-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary/40",
        styles.border,
        styles.bg,
        error ? "ring-1 ring-red-400/50" : null,
      )}
    >
      <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-full bg-surface-elevated shadow-sm">
        <MapPin className="size-4 text-brand-primary" aria-hidden />
      </span>
      <span className="min-w-0 flex-1 space-y-1">
        <span className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-semibold text-text-primary">{label}</span>
          <span
            className={cn(
              "rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
              styles.badge,
            )}
          >
            {styles.badgeText}
          </span>
        </span>
        {hasLocation ? (
          <>
            <span className="block text-sm text-text-primary line-clamp-2">{point.address}</span>
            {contactLine ? (
              <span className="block text-xs text-text-secondary">{contactLine}</span>
            ) : (
              <span className="block text-xs text-amber-700 dark:text-amber-400">
                Falta contacto de quien {label.toLowerCase().includes("recojo") ? "entrega" : "recibe"}
              </span>
            )}
          </>
        ) : (
          <span className="block text-sm text-text-secondary">{emptyHint}</span>
        )}
        {error ? <span className="block text-xs text-red-600">{error}</span> : null}
      </span>
      <ChevronRight className="mt-1 size-5 shrink-0 text-text-secondary" aria-hidden />
    </button>
  );
}
