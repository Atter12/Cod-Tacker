"use client";

import { Info, Minus, Plus, Send } from "lucide-react";
import type { FlipyFleteQuote } from "@/lib/integrations/flipy/partner-contract";
import { formatCurrency } from "@/lib/formatting/currency";
import { cn } from "@/lib/utils/cn";

const FLIPY_FLETE_CURRENCY = "PEN";

type Props = {
  value: string;
  onChange: (value: string) => void;
  locked: boolean;
  quoting: boolean;
  quoteError: string | null;
  fleteQuote: FlipyFleteQuote | null;
  coordsReady: boolean;
  validationError?: string | null;
  variant?: "default" | "ruta";
};

function parseFleteAmount(raw: string): number | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const parsed = Number.parseFloat(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
}

function clampOffer(
  amount: number,
  min?: number | null,
  max?: number | null,
): number {
  let next = Math.round(amount * 100) / 100;
  if (min != null && Number.isFinite(min)) next = Math.max(min, next);
  if (max != null && Number.isFinite(max)) next = Math.min(max, next);
  return next;
}

function formatFlipySoles(value: number): string {
  return formatCurrency(value, FLIPY_FLETE_CURRENCY);
}

function readCompetitiveRange(quote: FlipyFleteQuote): { low: number; high: number } | null {
  const low = quote.marketLow ?? quote.minOffer;
  const high = quote.marketHigh ?? quote.maxOffer;
  if (low == null || high == null || !Number.isFinite(low) || !Number.isFinite(high)) {
    return null;
  }
  return { low, high };
}

function buildSuggestions(
  recommended: number | null | undefined,
  range: { low: number; high: number } | null,
): number[] {
  if (recommended == null || !Number.isFinite(recommended)) return [];
  if (range) {
    const mid = recommended;
    const low = Math.round(range.low * 100) / 100;
    const high = Math.round(range.high * 100) / 100;
    const unique = [low, mid, high].filter((v, i, arr) => arr.indexOf(v) === i);
    return unique.slice(0, 3);
  }
  return [
    clampOffer(recommended - 2, null, null),
    recommended,
    clampOffer(recommended + 3, null, null),
  ];
}

export function FlipyFleteOfferCard({
  value,
  onChange,
  locked,
  quoting,
  quoteError,
  fleteQuote,
  coordsReady,
  validationError,
  variant = "default",
}: Props) {
  const parsedValue = parseFleteAmount(value);
  const recommended = fleteQuote?.recommendedFare;
  const displayAmount =
    parsedValue ?? (recommended != null && Number.isFinite(recommended) ? recommended : null);

  const minBound = fleteQuote?.minOffer;
  const maxBound = fleteQuote?.maxOffer;
  const competitiveRange = fleteQuote ? readCompetitiveRange(fleteQuote) : null;
  const suggestions = buildSuggestions(recommended, competitiveRange);

  function applyAmount(amount: number) {
    const clamped = clampOffer(amount, minBound, maxBound);
    onChange(String(clamped));
  }

  function adjustBy(delta: number) {
    const base = parsedValue ?? recommended ?? 0;
    if (!Number.isFinite(base)) return;
    applyAmount(base + delta);
  }

  const isRuta = variant === "ruta";

  return (
    <div className="rounded-2xl border border-border bg-muted/20 p-4 sm:p-5">
      <div className="flex items-start gap-3">
        <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-brand-softer text-brand-primary">
          <Send className="size-5" aria-hidden />
        </div>
        <div className="min-w-0">
          <p className="text-base font-semibold text-text-primary">
            {locked
              ? "Flete (cotización Flipy)"
              : isRuta
                ? "Cuánto ofreces por este envío"
                : "Tu oferta de flete"}
          </p>
          {quoting ? (
            <p className="text-sm text-text-secondary">Cotizando flete…</p>
          ) : isRuta ? (
            <p className="text-sm text-text-secondary">
              Los motorizados pujan desde tu oferta hacia arriba. A mayor oferta, más rápido se toma
              el pedido.
            </p>
          ) : fleteQuote?.distanceKm != null ? (
            <p className="text-sm text-text-secondary">
              {fleteQuote.distanceKm.toFixed(1)} km
              {fleteQuote.durationMinutes != null ? ` · ~${fleteQuote.durationMinutes} min` : ""}
            </p>
          ) : coordsReady ? (
            <p className="text-sm text-text-secondary">Calculando ruta…</p>
          ) : (
            <p className="text-sm text-text-secondary">Indica recojo y entrega para cotizar</p>
          )}
        </div>
      </div>

      <div
        className={cn(
          "mt-4 flex items-center justify-center gap-4",
          isRuta ? "rounded-xl border border-border bg-surface-elevated px-4 py-4" : null,
        )}
        aria-live="polite"
      >
        {!locked && displayAmount != null ? (
          <button
            type="button"
            className="grid size-10 place-items-center rounded-full border border-border bg-surface-elevated text-lg font-semibold text-text-primary transition-colors hover:bg-muted/50 disabled:opacity-40"
            onClick={() => adjustBy(-1)}
            aria-label="Bajar 1 sol"
          >
            <Minus className="size-4" aria-hidden />
          </button>
        ) : null}

        <div className="min-w-[8rem] text-center">
          {displayAmount != null ? (
            <p
              className={cn(
                "font-bold tracking-tight text-text-primary",
                isRuta ? "text-3xl sm:text-4xl" : "text-4xl sm:text-[42px]",
                quoting ? "opacity-50" : "",
              )}
            >
              {formatFlipySoles(displayAmount)}
            </p>
          ) : (
            <p className="text-lg font-medium text-text-secondary">—</p>
          )}
          {quoting ? (
            <p className="mt-1 text-xs font-medium text-brand-primary">Actualizando cotización…</p>
          ) : null}
        </div>

        {!locked && displayAmount != null ? (
          <button
            type="button"
            className="grid size-10 place-items-center rounded-full border border-border bg-surface-elevated text-lg font-semibold text-text-primary transition-colors hover:bg-muted/50 disabled:opacity-40"
            onClick={() => adjustBy(1)}
            aria-label="Subir 1 sol"
          >
            <Plus className="size-4" aria-hidden />
          </button>
        ) : null}
      </div>

      {locked ? (
        <p className="mt-3 text-center text-sm text-text-secondary">
          Asignación automática — flete fijo según cotización Flipy.
        </p>
      ) : null}

      {!locked && fleteQuote && suggestions.length > 0 ? (
        <div className="mt-4 space-y-2">
          <p className="text-xs font-medium text-text-secondary">Sugerencias:</p>
          <div className="flex flex-wrap gap-2">
            {suggestions.map((amount) => {
              const isRecommended =
                recommended != null && Math.abs(amount - recommended) < 0.01;
              const isSelected =
                displayAmount != null && Math.abs(displayAmount - amount) < 0.01;
              return (
                <button
                  key={amount}
                  type="button"
                  onClick={() => applyAmount(amount)}
                  className={cn(
                    "rounded-full border px-3 py-1.5 text-sm font-medium transition-colors",
                    isSelected || isRecommended
                      ? "border-brand-primary bg-brand-softer text-brand-primary"
                      : "border-border bg-surface-elevated text-text-secondary hover:border-brand-primary/40",
                  )}
                >
                  {formatFlipySoles(amount)}
                  {isRecommended ? " — recomendado" : ""}
                </button>
              );
            })}
          </div>
        </div>
      ) : null}

      {!locked && competitiveRange && fleteQuote?.distanceKm != null ? (
        <p className="mt-4 flex items-start gap-2 text-xs leading-relaxed text-text-secondary">
          <Info className="mt-0.5 size-3.5 shrink-0 text-brand-primary" aria-hidden />
          <span>
            Rango de mercado para {fleteQuote.distanceKm.toFixed(1)} km:{" "}
            <span className="font-medium text-text-primary">
              {formatFlipySoles(competitiveRange.low)} – {formatFlipySoles(competitiveRange.high)}
            </span>
            . El cliente paga en destino{" "}
            <span className="font-medium">producto + flete</span> según lo que
            falte cobrar.
          </span>
        </p>
      ) : null}

      {quoteError ? (
        <p className="mt-3 text-center text-xs text-danger">{quoteError}</p>
      ) : null}

      {validationError ? (
        <p className="mt-2 text-center text-xs text-danger">{validationError}</p>
      ) : null}
    </div>
  );
}
