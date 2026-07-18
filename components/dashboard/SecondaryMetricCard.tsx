import type { LucideIcon } from "lucide-react";
import { ArrowDown, ArrowUp } from "lucide-react";
import { MetricSparkline } from "@/components/dashboard/MetricSparkline";
import {
  DataConfidenceBadge,
  type DataConfidence,
} from "@/components/ui/DataConfidenceBadge";
import { cn } from "@/lib/utils/cn";
import type { MetricComparison } from "@/types/dashboard";

function formatChange(
  changePercent: number | null,
  absoluteDelta: number | null,
  mode: "percent" | "pp" | "absolute",
): string {
  if (changePercent == null && absoluteDelta == null) return "Sin comparación";
  if (mode === "absolute" && absoluteDelta != null) {
    const sign = absoluteDelta > 0 ? "+" : absoluteDelta < 0 ? "−" : "";
    return `${sign}${Math.abs(absoluteDelta).toFixed(2)}`;
  }
  if (mode === "pp" && absoluteDelta != null) {
    const sign = absoluteDelta > 0 ? "+" : absoluteDelta < 0 ? "−" : "";
    return `${sign}${Math.abs(absoluteDelta * 100).toFixed(1)} pp`;
  }
  if (changePercent == null) return "Sin comparación";
  const abs = Math.abs(changePercent).toFixed(1);
  return `${changePercent > 0 ? "+" : changePercent < 0 ? "−" : ""}${abs}%`;
}

export function SecondaryMetricCard({
  label,
  value,
  metric,
  sparkline,
  icon: Icon,
  increaseIsGood = true,
  comparisonLabel,
  changeMode = "percent",
  confidence,
  confidenceLabel,
  hint,
}: {
  label: string;
  value: string;
  metric: MetricComparison;
  sparkline: number[];
  icon: LucideIcon;
  increaseIsGood?: boolean;
  comparisonLabel: string;
  changeMode?: "percent" | "pp" | "absolute";
  confidence?: DataConfidence;
  /** Override badge text (e.g. Cobrado instead of Confirmado). */
  confidenceLabel?: string;
  hint?: string;
}) {
  const delta = metric.value - metric.previousValue;
  const change = metric.changePercent;
  const signal = changeMode === "percent" ? change : delta;
  const improved =
    signal == null || (changeMode === "percent" && change == null)
      ? null
      : increaseIsGood
        ? signal >= 0
        : signal <= 0;
  const directionUp = (changeMode === "percent" ? (change ?? 0) : delta) > 0;
  const directionDown = (changeMode === "percent" ? (change ?? 0) : delta) < 0;
  const hasComparison =
    changeMode === "percent" ? change != null : Number.isFinite(delta);

  return (
    <article className="flex min-h-[110px] flex-col rounded-[11px] border border-border bg-surface-elevated p-3.5 shadow-[var(--card-shadow)] sm:min-h-[115px] sm:p-4">
      <div className="flex items-start justify-between gap-2">
        <span className="grid size-9 place-items-center rounded-full bg-brand-softer text-brand-primary">
          <Icon className="size-4" aria-hidden />
        </span>
        <MetricSparkline data={sparkline} width={56} height={22} />
      </div>
      <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
        <p className="text-[12.5px] font-semibold text-text-secondary">{label}</p>
        {confidence ? (
          <DataConfidenceBadge confidence={confidence} label={confidenceLabel} />
        ) : null}
      </div>
      <p className="mt-0.5 text-[23px] font-bold leading-tight tracking-tight text-text-primary sm:text-[24px]">
        {value}
      </p>
      {hint ? <p className="mt-1 text-[10.5px] leading-snug text-text-secondary">{hint}</p> : null}
      <p
        className={cn(
          "mt-auto flex flex-wrap items-center gap-1 pt-2 text-[11px]",
          !hasComparison && "text-text-secondary",
          improved === true && "text-success",
          improved === false && "text-danger",
        )}
      >
        {hasComparison && directionUp ? <ArrowUp className="size-3" aria-hidden /> : null}
        {hasComparison && directionDown ? <ArrowDown className="size-3" aria-hidden /> : null}
        <span className="font-medium">
          {formatChange(change, delta, changeMode)}
        </span>
        <span className="text-text-secondary">vs. {comparisonLabel}</span>
      </p>
    </article>
  );
}
