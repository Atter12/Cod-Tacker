import { cn } from "@/lib/utils/cn";

/** Visible badge for mock/demo integrations — never present mock as a live connection. */
export function DemoModeBadge({
  className,
  compact = false,
}: {
  className?: string;
  /** Shorter label for dense cards */
  compact?: boolean;
}) {
  return (
    <span
      role="status"
      className={cn(
        "inline-flex items-center rounded-md border border-warning/40 bg-warning/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-warning",
        className,
      )}
    >
      {compact ? "Modo demo" : "Modo demostración"}
    </span>
  );
}
