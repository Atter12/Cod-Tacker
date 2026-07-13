import { Info } from "lucide-react";
import { Tooltip } from "@/components/ui/Tooltip";
import { cn } from "@/lib/utils/cn";
import type { DashboardFunnel, MetricComparison } from "@/types/dashboard";

const STEPS = [
  { key: "generated" as const, label: "Pedidos generados", color: "var(--chart-1)", width: "100%" },
  { key: "confirmed" as const, label: "Confirmados", color: "var(--chart-ramp-2)", width: "88%" },
  { key: "delivered" as const, label: "Entregados", color: "var(--chart-3)", width: "74%" },
  { key: "returned" as const, label: "Devueltos", color: "var(--chart-4)", width: "58%" },
];

function percentOf(value: number, base: number): string {
  if (!base) return value === 0 ? "0%" : "—";
  return `${((value / base) * 100).toFixed(value / base === 1 ? 0 : 1)}%`;
}

export function OperationalFunnel({
  funnel,
  confirmationRate,
  deliveryRate,
}: {
  funnel: DashboardFunnel;
  confirmationRate: MetricComparison;
  deliveryRate: MetricComparison;
}) {
  const values = {
    generated: funnel.generated,
    confirmed: funnel.confirmed,
    delivered: funnel.delivered,
    returned: funnel.returned,
  };
  const base = funnel.generated;

  return (
    <article className="flex h-full min-h-[320px] flex-col rounded-[11px] border border-border bg-surface-elevated p-4 shadow-[var(--card-shadow)] sm:p-5">
      <div className="flex items-start gap-1.5">
        <h2 className="text-[13px] font-semibold text-text-primary">Embudo operativo</h2>
        <Tooltip content="Generados, confirmados, entregados y devueltos en el período seleccionado.">
          <Info className="mt-0.5 size-3.5 text-text-secondary" aria-hidden />
        </Tooltip>
      </div>
      <p className="mt-1 text-[12px] text-text-secondary">
        Generados, confirmados, entregados y devueltos.
      </p>

      <div className="mt-5 flex flex-1 flex-col gap-5 sm:flex-row sm:items-center">
        <div
          className="mx-auto flex w-full max-w-[200px] flex-col gap-1 sm:mx-0 sm:w-[42%]"
          role="img"
          aria-label="Embudo operativo de pedidos"
        >
          {STEPS.map((step, index) => {
            const inset = index * 7;
            return (
              <div
                key={step.key}
                className="h-9 w-full"
                style={{
                  clipPath: `polygon(${inset}% 0, ${100 - inset}% 0, ${100 - inset - 6}% 100%, ${inset + 6}% 100%)`,
                  backgroundColor: step.color,
                  width: step.width,
                  marginInline: "auto",
                }}
              />
            );
          })}
        </div>

        <ul className="min-w-0 flex-1 space-y-2.5">
          {STEPS.map((step) => (
            <li key={step.key} className="grid grid-cols-[1fr_auto_auto] items-center gap-3 text-[12.5px]">
              <span className="flex min-w-0 items-center gap-2 text-text-primary">
                <span
                  className="size-2 shrink-0 rounded-full"
                  style={{ backgroundColor: step.color }}
                  aria-hidden
                />
                <span className="truncate">{step.label}</span>
              </span>
              <span className="tabular-nums font-semibold text-text-primary">
                {values[step.key].toLocaleString("es-PE")}
              </span>
              <span className="w-12 text-right tabular-nums text-text-secondary">
                {percentOf(values[step.key], base)}
              </span>
            </li>
          ))}
        </ul>
      </div>

      <div className="mt-5 flex flex-wrap gap-x-6 gap-y-2 border-t border-border pt-3 text-[12px]">
        <p>
          <span className="text-text-secondary">Tasa de confirmación: </span>
          <span className="font-semibold text-text-primary">
            {(confirmationRate.value * 100).toFixed(1)}%
          </span>
        </p>
        <p>
          <span className="text-text-secondary">Tasa de entrega: </span>
          <span className={cn("font-semibold text-text-primary")}>
            {(deliveryRate.value * 100).toFixed(1)}%
          </span>
        </p>
      </div>
    </article>
  );
}
