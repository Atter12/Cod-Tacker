import "server-only";

import { createFlipyPartnerClient } from "@/lib/integrations/flipy/client";
import type { FlipyFleteQuote } from "@/lib/integrations/flipy/partner-contract";
import type { FlipyPackageSize } from "@/lib/integrations/flipy/map-package-size";

type FlipyClient = ReturnType<typeof createFlipyPartnerClient>;

export async function cotizarFlipyFleteForRoute(
  client: FlipyClient,
  input: {
    originLat: number;
    originLng: number;
    destinationLat: number;
    destinationLng: number;
    packageSize?: FlipyPackageSize;
  },
): Promise<FlipyFleteQuote> {
  const coords = [
    input.originLat,
    input.originLng,
    input.destinationLat,
    input.destinationLng,
  ];
  if (coords.some((value) => !Number.isFinite(value))) {
    throw new Error("Coordenadas inválidas para cotizar flete Flipy.");
  }

  const quoted = await client.cotizarEnvio({
    originLat: input.originLat,
    originLng: input.originLng,
    destinationLat: input.destinationLat,
    destinationLng: input.destinationLng,
    packageSize: input.packageSize ?? "mediano",
    typeMode: "express",
  });

  return quoted.fleteQuote;
}
