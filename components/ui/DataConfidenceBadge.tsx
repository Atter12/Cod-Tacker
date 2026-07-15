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
  className,
}: {
  confidence: DataConfidence;
  className?: string;
}) {
  return (
    <Badge className={cn(CLASSES[confidence], className)} title={tooltip(confidence)}>
      {LABELS[confidence]}
    </Badge>
  );
}

function tooltip(confidence: DataConfidence): string {
  if (confidence === "provisional") {
    return "Dato estimado. Carriers y cobros pueden tardar; aún no es definitivo.";
  }
  return "Dato confirmado por cobro registrado (no es estimado de entrega).";
}
