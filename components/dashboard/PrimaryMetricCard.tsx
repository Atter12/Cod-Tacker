import type { LucideIcon } from "lucide-react";
import { ArrowDown, ArrowUp } from "lucide-react";
import { MetricSparkline } from "@/components/dashboard/MetricSparkline";
import { cn } from "@/lib/utils/cn";
import type { MetricComparison } from "@/types/dashboard";

function formatChange(changePercent: number | null): string {
  if (changePercent == null) return "Sin comparación";
  const abs = Math.abs(changePercent).toFixed(1);
  return `${changePercent > 0 ? "+" : changePercent < 0 ? "−" : ""}${abs}%`;
}

export function PrimaryMetricCard({
  label,
  value,
  metric,
  sparkline,
  icon: Icon,
  increaseIsGood = true,
  comparisonLabel,
}: {
  label: string;
  value: string;
  metric: MetricComparison;
  sparkline: number[];
  icon: LucideIcon;
  increaseIsGood?: boolean;
  comparisonLabel: string;
}) {
  const change = metric.changePercent;
  const improved =
    change == null ? null : increaseIsGood ? change >= 0 : change <= 0;
  const directionUp = change != null && change > 0;
  const directionDown = change != null && change < 0;

  return (
    <article className="flex min-h-[92px] flex-col justify-between rounded-[11px] border border-border bg-surface-elevated p-3.5 shadow-[var(--card-shadow)] sm:min-h-[96px] sm:p-4">
      <div className="flex items-start gap-3">
        <span className="grid size-[38px] shrink-0 place-items-center rounded-full bg-brand-softer text-brand-primary">
          <Icon className="size-[17px]" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[12.5px] font-semibold text-text-secondary">{label}</p>
          <p className="mt-0.5 truncate text-[24px] font-bold leading-tight tracking-tight text-text-primary sm:text-[26px]">
            {value}
          </p>
        </div>
        <MetricSparkline data={sparkline} className="mt-1 hidden sm:block" />
      </div>
      <p
        className={cn(
          "mt-2 flex flex-wrap items-center gap-1 text-[11px]",
          change == null && "text-text-secondary",
          improved === true && "text-success",
          improved === false && "text-danger",
        )}
      >
        {directionUp ? <ArrowUp className="size-3" aria-hidden /> : null}
        {directionDown ? <ArrowDown className="size-3" aria-hidden /> : null}
        <span className="font-medium">{formatChange(change)}</span>
        <span className="text-text-secondary">vs. {comparisonLabel}</span>
      </p>
    </article>
  );
}
