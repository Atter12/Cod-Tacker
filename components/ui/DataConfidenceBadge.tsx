import { Badge } from "@/components/ui/Badge";
import { cn } from "@/lib/utils/cn";

export type DataConfidence = "provisional" | "confirmed";

const LABELS: Record<DataConfidence, string> = {
  provisional: "Provisional",
  confirmed: "Confirmado",
};

const CLASSES: Record<DataConfidence, string> = {
  provisional: "bg-warning/10 text-warning",
  confirmed: "bg-success/10 text-success",
};

/** Honest signal: estimated data vs cash/carrier-confirmed data. */
export function DataConfidenceBadge({
  confidence,
  label,
  className,
}: {
  confidence: DataConfidence;
  /** Override default Provisional / Confirmado (e.g. Cobrado, En curso). */
  label?: string;
  className?: string;
}) {
  return (
    <Badge className={cn(CLASSES[confidence], className)} title={tooltip(confidence, label)}>
      {label ?? LABELS[confidence]}
    </Badge>
  );
}

function tooltip(confidence: DataConfidence, label?: string): string {
  if (label === "Cobrado") {
    return "ROAS con efectivo cobrado registrado. No es ROAS de checkout ni de entrega estimada.";
  }
  if (label === "En curso") {
    return "El envío aún no cerró en el carrier. No es confirmación final.";
  }
  if (confidence === "provisional") {
    return "Dato estimado. Carriers y cobros pueden tardar; aún no es definitivo.";
  }
  return "Dato confirmado por cobro registrado o cierre terminal del envío (no es estimado de checkout).";
}
