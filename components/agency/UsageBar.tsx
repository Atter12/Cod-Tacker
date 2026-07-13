import { cn } from "@/lib/utils/cn";

export function UsageBar({
  label,
  valueLabel,
  ratio,
  overLimit = false,
  className,
}: {
  label?: string;
  valueLabel: string;
  ratio: number;
  overLimit?: boolean;
  className?: string;
}) {
  const pct = Math.max(0, Math.min(100, Math.round(ratio * 100)));
  return (
    <div className={cn("space-y-1.5", className)}>
      {(label || valueLabel) && (
        <div className="flex items-center justify-between gap-3 text-[12.5px]">
          {label ? <span className="text-text-primary">{label}</span> : <span />}
          <span className={cn("font-semibold tabular-nums", overLimit ? "text-danger" : "text-text-primary")}>
            {valueLabel}
          </span>
        </div>
      )}
      <div className="h-1.5 overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
        <div
          className={cn("h-full rounded-full transition-[width]", overLimit ? "bg-danger" : "bg-brand-primary")}
          style={{ width: `${Math.min(100, Math.max(overLimit ? 100 : 2, pct))}%` }}
        />
      </div>
    </div>
  );
}
