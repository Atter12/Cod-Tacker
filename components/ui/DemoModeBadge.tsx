import { cn } from "@/lib/utils/cn";

/** Visible badge for mock/demo integrations — never present mock as a live connection. */
export function DemoModeBadge({ className }: { className?: string }) {
  return (
    <span
      role="status"
      className={cn(
        "inline-flex items-center rounded-md border border-warning/40 bg-warning/10 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-warning",
        className,
      )}
    >
      Modo demostración
    </span>
  );
}
