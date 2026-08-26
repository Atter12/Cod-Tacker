import type { FlipyPackageSize } from "@/lib/integrations/flipy/map-package-size";
import type { FlipyFleteQuote, FlipyTypeMode } from "@/lib/integrations/flipy/partner-contract";

/** Paridad con Flipy fleteQuote.js + monetizacion.js */
const FLETE = {
  baseFare: 5,
  perKm: 1.4,
  minFare: 5,
  maxFareCap: 300,
  sizeSurcharge: { pequeno: 0, mediano: 1.5, grande: 3.5 } as Record<FlipyPackageSize, number>,
  expressSurcharge: 1,
  roundStep: 0.5,
  marketLowFactor: 0.85,
  marketHighFactor: 1.2,
  minOfferFactor: 0.7,
  maxOfferFactor: 3,
};

export type FlipyFleteQuoteSource = "directions" | "haversine";

function roundMoney(n: number): number {
  return Math.round(Math.round(n / FLETE.roundStep) * FLETE.roundStep * 100) / 100;
}

/** ~1 m precision — avoids re-cotizar on micro pin jitter. */
export function buildFlipyRouteKey(input: {
  originLat: number;
  originLng: number;
  destinationLat: number;
  destinationLng: number;
}): string {
  const r = (n: number) => (Math.round(n * 1e5) / 1e5).toFixed(5);
  return `${r(input.originLat)},${r(input.originLng)}|${r(input.destinationLat)},${r(input.destinationLng)}`;
}

export function recalcFleteFromDistance(
  distanceKm: number,
  packageSize: FlipyPackageSize,
  typeMode: FlipyTypeMode = "express",
  source: FlipyFleteQuoteSource = "directions",
  preserved?: Pick<FlipyFleteQuote, "durationMinutes">,
): FlipyFleteQuote {
  const sizeSurcharge = FLETE.sizeSurcharge[packageSize] ?? 1.5;
  const expressSurcharge = typeMode === "express" ? FLETE.expressSurcharge : 0;
  const distanceCharge = Math.round(distanceKm * FLETE.perKm * 100) / 100;
  const raw = FLETE.baseFare + distanceCharge + sizeSurcharge + expressSurcharge;
  const recommendedFare = Math.max(FLETE.minFare, roundMoney(raw));

  return {
    version: 2,
    recommendedFare,
    marketLow: Math.max(FLETE.minFare, roundMoney(recommendedFare * FLETE.marketLowFactor)),
    marketHigh: roundMoney(recommendedFare * FLETE.marketHighFactor),
    minOffer: Math.max(FLETE.minFare, roundMoney(recommendedFare * FLETE.minOfferFactor)),
    maxOffer: Math.min(FLETE.maxFareCap, roundMoney(recommendedFare * FLETE.maxOfferFactor)),
    distanceKm,
    durationMinutes: preserved?.durationMinutes,
    packageSize,
    typeMode,
    source,
  };
}

export function canRecalcFleteLocally(quote: FlipyFleteQuote | null | undefined): boolean {
  return quote != null && quote.distanceKm != null && Number.isFinite(quote.distanceKm);
}
