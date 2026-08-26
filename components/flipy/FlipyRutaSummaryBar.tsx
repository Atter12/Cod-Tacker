"use client";

import { formatCurrency } from "@/lib/formatting/currency";

type Props = {
  productLabel: string;
  fleteAmount: number | null;
  destinoCobroLabel: string;
  currencyCode?: string;
};

export function FlipyRutaSummaryBar({
  productLabel,
  fleteAmount,
  destinoCobroLabel,
  currencyCode = "PEN",
}: Props) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-muted/25 px-4 py-3 text-sm">
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
        <p>
          <span className="text-text-secondary">Producto </span>
          <span className="font-semibold text-text-primary">{productLabel}</span>
        </p>
        <p>
          <span className="text-text-secondary">Flete </span>
          <span className="font-semibold text-text-primary">
            {fleteAmount != null ? formatCurrency(fleteAmount, currencyCode) : "—"}
          </span>
        </p>
        <p className="max-w-xs">
          <span className="text-text-secondary">Cobrar en destino </span>
          <span className="font-semibold text-text-primary">{destinoCobroLabel}</span>
        </p>
      </div>
      <p className="text-xs text-text-secondary">Actualiza al confirmar entrega</p>
    </div>
  );
}
