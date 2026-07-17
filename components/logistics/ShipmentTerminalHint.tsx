import { DataConfidenceBadge } from "@/components/ui/DataConfidenceBadge";
import { cn } from "@/lib/utils/cn";

/**
 * "Confirmado" only when the shipment is terminal (delivered / returned / etc.).
 * Mid-funnel statuses stay provisional — aligned with B10/B13.
 */
export function ShipmentTerminalHint({
  isTerminal,
  className,
}: {
  isTerminal: boolean;
  className?: string;
}) {
  if (isTerminal) {
    return (
      <div
        className={cn(
          "flex flex-wrap items-start gap-2 rounded-[10px] border border-success/25 bg-success/5 px-3 py-2.5 text-[12.5px] text-text-secondary",
          className,
        )}
        role="status"
      >
        <DataConfidenceBadge confidence="confirmed" label="Confirmado" />
        <p className="min-w-0 flex-1 leading-snug">
          Estado final del envío (cerrado en carrier). Ya no está en tránsito.
        </p>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "flex flex-wrap items-start gap-2 rounded-[10px] border border-border bg-muted/40 px-3 py-2.5 text-[12.5px] text-text-secondary",
        className,
      )}
      role="status"
    >
      <DataConfidenceBadge confidence="provisional" label="En curso" />
      <p className="min-w-0 flex-1 leading-snug">
        El envío sigue abierto. No uses esto como confirmación final de entrega.
      </p>
    </div>
  );
}
