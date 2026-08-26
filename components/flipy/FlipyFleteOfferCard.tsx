"use client";

import { Send } from "lucide-react";
import type { FlipyFleteQuote } from "@/lib/integrations/flipy/partner-contract";
import { formatCurrency } from "@/lib/formatting/currency";

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

export function FlipyFleteOfferCard({
  value,
  onChange,
  locked,
  quoting,
  quoteError,
  fleteQuote,
  coordsReady,
  validationError,
}: Props) {
  const parsedValue = parseFleteAmount(value);
  const recommended = fleteQuote?.recommendedFare;
  const displayAmount =
    parsedValue ?? (recommended != null && Number.isFinite(recommended) ? recommended : null);

  const minBound = fleteQuote?.minOffer;
  const maxBound = fleteQuote?.maxOffer;
  const competitiveRange = fleteQuote ? readCompetitiveRange(fleteQuote) : null;

  function applyAmount(amount: number) {
    const clamped = clampOffer(amount, minBound, maxBound);
    onChange(String(clamped));
  }

  function adjustBy(delta: number) {
    const base = parsedValue ?? recommended ?? 0;
    if (!Number.isFinite(base)) return;
    applyAmount(base + delta);
  }

  function resetToRecommended() {
    if (recommended == null || !Number.isFinite(recommended)) return;
    applyAmount(recommended);
  }

  const routeMeta =
    fleteQuote?.distanceKm != null && fleteQuote?.durationMinutes != null
      ? `${fleteQuote.distanceKm.toFixed(1)} km · ~${fleteQuote.durationMinutes} min`
      : fleteQuote?.distanceKm != null
        ? `${fleteQuote.distanceKm.toFixed(1)} km`
        : null;

  const isAtRecommended =
    recommended != null &&
    displayAmount != null &&
    Math.abs(displayAmount - recommended) < 0.01;

  return (
    <div className="rounded-2xl border border-border bg-surface-elevated p-4 shadow-sm">
      <div className="flex items-start gap-3">
        <div className="grid size-11 shrink-0 place-items-center rounded-xl bg-brand-softer text-brand-primary">
          <Send className="size-5" aria-hidden />
        </div>
        <div className="min-w-0">
          <p className="text-base font-semibold text-text-primary">
            {locked ? "Flete (cotización Flipy)" : "Tu oferta de flete"}
          </p>
          {routeMeta ? (
            <p className="text-sm text-text-secondary">{routeMeta}</p>
          ) : quoting ? (
            <p className="text-sm text-text-secondary">Cotizando flete…</p>
          ) : coordsReady ? (
            <p className="text-sm text-text-secondary">Calculando ruta…</p>
          ) : (
            <p className="text-sm text-text-secondary">Indica recojo y entrega para cotizar</p>
          )}
        </div>
      </div>

      <div
        className="mt-4 rounded-2xl border-2 border-brand-primary/70 bg-brand-softer/40 px-4 py-5 text-center"
        aria-live="polite"
      >
        {displayAmount != null ? (
          <p className="text-4xl font-bold tracking-tight text-text-primary sm:text-[42px]">
            {formatFlipySoles(displayAmount)}
          </p>
        ) : (
          <p className="text-lg font-medium text-text-secondary">—</p>
        )}
      </div>

      {locked ? (
        <p className="mt-3 text-center text-sm text-text-secondary">
          Asignación automática — flete fijo según cotización Flipy.
        </p>
      ) : (
        <p className="mt-3 text-center text-sm leading-relaxed text-text-secondary">
          Puedes bajar o subir el monto. Los motorizados pujan desde esta oferta hacia arriba.
        </p>
      )}

      {!locked && fleteQuote && displayAmount != null ? (
        <div className="mt-4 flex items-center justify-center gap-2 sm:gap-3">
          <button
            type="button"
            className="grid size-11 place-items-center rounded-full border border-border bg-surface-elevated text-sm font-semibold text-text-primary transition-colors hover:bg-muted/50 disabled:opacity-40"
            onClick={() => adjustBy(-2)}
            aria-label="Bajar 2 soles"
          >
            -2
          </button>
          <button
            type="button"
            className="grid size-11 place-items-center rounded-full border border-border bg-surface-elevated text-sm font-semibold text-text-primary transition-colors hover:bg-muted/50 disabled:opacity-40"
            onClick={() => adjustBy(-1)}
            aria-label="Bajar 1 sol"
          >
            -1
          </button>
          <button
            type="button"
            className={`min-w-[7.5rem] rounded-full border-2 px-4 py-2 text-sm font-semibold transition-colors ${
              isAtRecommended
                ? "border-brand-primary bg-brand-softer text-brand-primary"
                : "border-border bg-surface-elevated text-text-secondary hover:border-brand-primary/50 hover:text-brand-primary"
            }`}
            onClick={resetToRecommended}
            disabled={recommended == null}
          >
            Recomend. {recommended != null ? Math.round(recommended) : "—"}
          </button>
          <button
            type="button"
            className="grid size-11 place-items-center rounded-full border border-border bg-surface-elevated text-sm font-semibold text-text-primary transition-colors hover:bg-muted/50 disabled:opacity-40"
            onClick={() => adjustBy(1)}
            aria-label="Subir 1 sol"
          >
            +1
          </button>
          <button
            type="button"
            className="grid size-11 place-items-center rounded-full border border-border bg-surface-elevated text-sm font-semibold text-text-primary transition-colors hover:bg-muted/50 disabled:opacity-40"
            onClick={() => adjustBy(2)}
            aria-label="Subir 2 soles"
          >
            +2
          </button>
        </div>
      ) : null}

      {quoteError ? (
        <p className="mt-3 text-center text-xs text-danger">{quoteError}</p>
      ) : competitiveRange ? (
        <p className="mt-4 text-center text-xs text-text-secondary">
          Rango competitivo {formatFlipySoles(competitiveRange.low)} –{" "}
          {formatFlipySoles(competitiveRange.high)}
        </p>
      ) : null}

      {validationError ? (
        <p className="mt-2 text-center text-xs text-danger">{validationError}</p>
      ) : null}
    </div>
  );
}
