import { DataConfidenceBadge } from "@/components/ui/DataConfidenceBadge";
import { cn } from "@/lib/utils/cn";

/** Events older than this (or missing) count as stale / no carrier signal. */
export const LOGISTICS_STALE_MS = 24 * 3_600_000;

export function isLogisticsEventStale(lastEventAt: string | null | undefined): boolean {
  if (!lastEventAt?.trim()) return true;
  const ageMs = Date.now() - Date.parse(lastEventAt);
  if (!Number.isFinite(ageMs)) return true;
  return ageMs >= LOGISTICS_STALE_MS;
}

export function LogisticsLatencyNotice({
  mode,
  staleCount = 0,
  totalCount = 0,
  className,
}: {
  mode: "empty" | "stale" | "general";
  staleCount?: number;
  totalCount?: number;
  className?: string;
}) {
  const copy =
    mode === "empty"
      ? "Sin envíos ni señal carrier reciente. La logística no es tiempo real: trata estos datos como provisionales."
      : mode === "stale"
        ? `${staleCount} de ${totalCount} envío(s) sin evento reciente (más de 24 h o sin señal). Latencia de carrier; no vendas esto como tiempo real absoluto.`
        : "Los estados de carrier llegan con latencia. Sin evento reciente = provisional / sin señal.";

  return (
    <div
      className={cn(
        "flex flex-wrap items-start gap-2 rounded-[10px] border border-warning/30 bg-warning/5 px-3 py-2.5 text-[12.5px] text-text-secondary",
        className,
      )}
      role="status"
    >
      <DataConfidenceBadge confidence="provisional" />
      <p className="min-w-0 flex-1 leading-snug">{copy}</p>
    </div>
  );
}
