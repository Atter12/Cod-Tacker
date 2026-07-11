import { type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils/cn";

const toneStyles = {
  success: {
    icon: "bg-success-soft text-success",
    value: "text-text-primary",
  },
  danger: {
    icon: "bg-danger-soft text-danger",
    value: "text-text-primary",
  },
  brand: {
    icon: "bg-brand-soft text-brand-primary",
    value: "text-text-primary",
  },
} as const;

export function OperationsKpiCard({
  label,
  value,
  hint,
  icon: Icon,
  tone = "brand",
}: {
  label: string;
  value: number | string;
  hint: string;
  icon: LucideIcon;
  tone?: keyof typeof toneStyles;
}) {
  const styles = toneStyles[tone];

  return (
    <article className="rounded-[12px] border border-border bg-surface-elevated p-5 shadow-[var(--card-shadow)]">
      <div className="flex items-start gap-3.5">
        <span
          className={cn("grid size-10 shrink-0 place-items-center rounded-full", styles.icon)}
          aria-hidden
        >
          <Icon className="size-[18px]" />
        </span>
        <div className="min-w-0">
          <p className="text-[12px] font-medium text-text-secondary">{label}</p>
          <p className={cn("mt-1 text-[28px] font-bold leading-none tabular-nums tracking-tight", styles.value)}>
            {value}
          </p>
          <p className="mt-2 text-[11.5px] text-text-secondary">{hint}</p>
        </div>
      </div>
    </article>
  );
}
