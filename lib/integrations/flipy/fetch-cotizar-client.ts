import type { FlipyPackageSize } from "@/lib/integrations/flipy/map-package-size";
import type { FlipyFleteQuote, FlipyTypeMode } from "@/lib/integrations/flipy/partner-contract";
import { buildFlipyRouteKey } from "@/lib/integrations/flipy/flete-quote-local";

export type FetchFlipyCotizarInput = {
  agencySlug: string;
  storeSlug: string;
  originLat: number;
  originLng: number;
  destinationLat: number;
  destinationLng: number;
  packageSize?: FlipyPackageSize;
  typeMode?: FlipyTypeMode;
};

export type FetchFlipyCotizarResult = {
  fleteQuote?: FlipyFleteQuote;
  error?: string;
  errorCode?: string;
};

const inflight = new Map<string, Promise<FetchFlipyCotizarResult>>();

function buildDedupeKey(input: FetchFlipyCotizarInput): string {
  const routeKey = buildFlipyRouteKey({
    originLat: input.originLat,
    originLng: input.originLng,
    destinationLat: input.destinationLat,
    destinationLng: input.destinationLng,
  });
  return `${input.agencySlug}|${input.storeSlug}|${routeKey}|${input.packageSize ?? "mediano"}|${input.typeMode ?? "express"}`;
}

export async function fetchFlipyCotizar(
  input: FetchFlipyCotizarInput,
  signal?: AbortSignal,
): Promise<FetchFlipyCotizarResult> {
  const dedupeKey = buildDedupeKey(input);
  const existing = inflight.get(dedupeKey);
  if (existing) {
    return existing;
  }

  const promise = (async (): Promise<FetchFlipyCotizarResult> => {
    try {
      const res = await fetch("/api/integrations/flipy/cotizar", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify(input),
        signal,
        cache: "no-store",
      });
      const json = (await res.json()) as FetchFlipyCotizarResult;
      if (!res.ok) {
        return {
          error: json.error ?? "No se pudo cotizar el flete.",
          errorCode: json.errorCode,
        };
      }
      if (!json.fleteQuote) {
        return { error: "Flipy no devolvió fleteQuote." };
      }
      return { fleteQuote: json.fleteQuote };
    } catch (err) {
      if (signal?.aborted || (err instanceof DOMException && err.name === "AbortError")) {
        return { error: "Cotización cancelada." };
      }
      return {
        error: err instanceof Error ? err.message : "No se pudo cotizar el flete.",
      };
    } finally {
      inflight.delete(dedupeKey);
    }
  })();

  inflight.set(dedupeKey, promise);
  return promise;
}
