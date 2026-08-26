"use client";

import { Info } from "lucide-react";
import type { FlipyEscenarioPago } from "@/lib/integrations/flipy/resolve-payment";
import {
  type FlipyShopifyPaymentSummary,
} from "@/lib/integrations/flipy/labels";
import { FlipyEscenarioLabel } from "@/components/flipy/FlipyEscenarioLabel";
import { Alert } from "@/components/ui/Alert";
import { cn } from "@/lib/utils/cn";

const ESCENARIO_COBRO_HINT: Record<"1C" | "1E" | "1D", string> = {
  "1C": "El cliente paga en destino vía Yape directo al motorizado.",
  "1E": "El cliente paga en destino en efectivo al motorizado.",
  "1D": "El cliente paga en destino con tarjeta/Stripe en el link de rastreo.",
};

type EscenarioOption = {
  value: FlipyEscenarioPago;
  label: string;
  hint: string;
};

type Props = {
  summary: FlipyShopifyPaymentSummary;
  escenarioOptions: EscenarioOption[];
  escenario: FlipyEscenarioPago;
  suggestedEscenario: FlipyEscenarioPago | null | undefined;
  codAmountForEscenario: number | null;
  yapeTop: number;
  onSelectEscenario: (value: FlipyEscenarioPago) => void;
};

export function FlipyPaymentStepPanel({
  summary,
  escenarioOptions,
  escenario,
  suggestedEscenario,
  codAmountForEscenario,
  yapeTop,
  onSelectEscenario,
}: Props) {
  const showYapeWarning =
    escenario === "1C" && codAmountForEscenario != null && codAmountForEscenario > yapeTop;

  return (
    <div className="space-y-5">
      <div
        className="flex gap-3 rounded-xl border border-brand-primary/20 border-l-4 border-l-brand-primary bg-brand-softer/50 p-4"
        role="note"
      >
        <Info className="mt-0.5 size-5 shrink-0 text-brand-primary" aria-hidden />
        <p className="text-sm leading-relaxed text-text-secondary">{summary.alertBody}</p>
      </div>

      <div className="rounded-xl border border-border bg-muted/20 p-4">
        <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-text-secondary">
          Montos según Shopify
        </p>
        <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-text-secondary">Producto</dt>
            <dd className="mt-0.5 font-medium text-text-primary">{summary.productLabel}</dd>
          </div>
          <div>
            <dt className="text-text-secondary">Envío en checkout</dt>
            <dd className="mt-0.5 font-medium text-text-primary">{summary.shippingLabel}</dd>
          </div>
          {summary.codProductLabel ? (
            <div className="sm:col-span-2">
              <dt className="text-text-secondary">Producto a cobrar en destino</dt>
              <dd className="mt-0.5 font-medium text-text-primary">{summary.codProductLabel}</dd>
            </div>
          ) : null}
          <div className="sm:col-span-2">
            <dt className="text-text-secondary">Cobro en destino</dt>
            <dd className="mt-0.5 font-medium text-text-primary">{summary.destinoCobroLabel}</dd>
          </div>
        </dl>
      </div>

      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-base font-semibold text-text-primary">Selecciona el canal de cobro</h3>
          {suggestedEscenario === "1C" ||
          suggestedEscenario === "1E" ||
          suggestedEscenario === "1D" ? (
            <span className="rounded-full bg-brand-softer px-2.5 py-0.5 text-xs font-semibold text-brand-primary">
              Sugerido:{" "}
              <FlipyEscenarioLabel escenario={suggestedEscenario} className="font-semibold" />
            </span>
          ) : null}
        </div>

        <fieldset className="space-y-3">
          {escenarioOptions.map((opt) => {
            const code = opt.value as "1C" | "1E" | "1D";
            const selected = escenario === opt.value;
            const cobroHint = ESCENARIO_COBRO_HINT[code] ?? opt.hint;

            return (
              <label
                key={opt.value}
                className={cn(
                  "block cursor-pointer rounded-xl border-2 p-4 transition-colors",
                  selected
                    ? "border-brand-primary bg-brand-softer/40 shadow-sm"
                    : "border-border bg-surface-elevated hover:border-brand-primary/35 hover:bg-muted/20",
                )}
              >
                <div className="flex items-start gap-3">
                  <input
                    type="radio"
                    name="flipy-escenario"
                    value={opt.value}
                    checked={selected}
                    onChange={() => onSelectEscenario(opt.value)}
                    className="mt-1 size-4 shrink-0 accent-brand-primary"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <FlipyEscenarioLabel
                        escenario={opt.value}
                        className="font-semibold text-text-primary"
                      />
                    </div>
                    <p className="mt-1 text-sm leading-relaxed text-text-secondary">{cobroHint}</p>
                    <p className="mt-1 text-xs text-text-secondary/80">
                      Cobro: producto + flete · Según lo que falte cobrar
                    </p>
                  </div>
                </div>
              </label>
            );
          })}
        </fieldset>
      </div>

      {showYapeWarning ? (
        <Alert variant="warning" title="Tope Yape">
          El COD producto supera S/ {yapeTop}. Flipy puede rechazar Yape — considera Tarjeta (cobro
          digital en rastreo).
        </Alert>
      ) : null}
    </div>
  );
}
