import "server-only";

import { createFlipyPartnerClient } from "@/lib/integrations/flipy/client";
import type { FlipyPackageSize } from "@/lib/integrations/flipy/map-package-size";
import type { FlipyFleteQuote, FlipyTypeMode } from "@/lib/integrations/flipy/partner-contract";
import {
  readFlipyTiendaId,
  resolveFlipyPartnerKeyFromIntegration,
} from "@/lib/integrations/flipy/credentials";
import { IntegrationError, ValidationError } from "@/lib/errors";
import { getFlipyEnv } from "@/lib/integrations/flipy/env";
import { buildFlipyRouteKey } from "@/lib/integrations/flipy/flete-quote-local";
import { resolveFlipyIntegrationForStore } from "@/lib/integrations/flipy/webhook-ingress";
import { createAdminClient } from "@/lib/supabase/admin";

const CREDENTIAL_TTL_MS = 5 * 60 * 1000;

type CachedClient = {
  client: ReturnType<typeof createFlipyPartnerClient>;
  expiresAt: number;
};

const clientCache = new Map<string, CachedClient>();
const inflightQuotes = new Map<string, Promise<FlipyFleteQuote>>();

export type CotizarFlipyFleteInput = {
  agencyId: string;
  storeId: string;
  originLat: number;
  originLng: number;
  destinationLat: number;
  destinationLng: number;
  packageSize?: FlipyPackageSize;
  typeMode?: FlipyTypeMode;
};

export async function getFlipyClientForStore(agencyId: string, storeId: string) {
  const now = Date.now();
  const cached = clientCache.get(storeId);
  if (cached && cached.expiresAt > now) {
    return cached.client;
  }

  const admin = createAdminClient();
  const integration = await resolveFlipyIntegrationForStore(admin, agencyId, storeId);
  if (!integration || integration.status === "disconnected") {
    throw new IntegrationError("Conecta Flipy en Integraciones antes de cotizar.");
  }

  const partnerKey = resolveFlipyPartnerKeyFromIntegration(integration);
  if (!partnerKey) {
    throw new IntegrationError("FLIPY_PARTNER_API_KEY no configurada.");
  }

  const flipyTiendaId = readFlipyTiendaId(integration.settings) ?? integration.external_account_id;
  if (!flipyTiendaId) {
    throw new IntegrationError("Integración Flipy sin tiendaId. Reconecta Flipy.");
  }

  const env = getFlipyEnv();
  const client = createFlipyPartnerClient({
    baseUrl: env.apiBaseUrl,
    partnerKey,
    partnerId: env.partnerId,
    externalStoreId: storeId,
  });

  clientCache.set(storeId, { client, expiresAt: now + CREDENTIAL_TTL_MS });
  return client;
}

function buildInflightKey(input: CotizarFlipyFleteInput): string {
  const routeKey = buildFlipyRouteKey({
    originLat: input.originLat,
    originLng: input.originLng,
    destinationLat: input.destinationLat,
    destinationLng: input.destinationLng,
  });
  return `${input.storeId}|${routeKey}|${input.packageSize ?? "mediano"}|${input.typeMode ?? "express"}`;
}

export async function cotizarFlipyFleteForStore(input: CotizarFlipyFleteInput): Promise<FlipyFleteQuote> {
  const coords = [
    input.originLat,
    input.originLng,
    input.destinationLat,
    input.destinationLng,
  ];
  if (coords.some((value) => !Number.isFinite(value))) {
    throw new ValidationError("Coordenadas de origen y destino inválidas.");
  }

  const inflightKey = buildInflightKey(input);
  const inflight = inflightQuotes.get(inflightKey);
  if (inflight) return inflight;

  const promise = (async () => {
    const client = await getFlipyClientForStore(input.agencyId, input.storeId);
    const quoted = await client.cotizarEnvio({
      originLat: input.originLat,
      originLng: input.originLng,
      destinationLat: input.destinationLat,
      destinationLng: input.destinationLng,
      packageSize: input.packageSize ?? "mediano",
      typeMode: input.typeMode ?? "express",
    });
    return quoted.fleteQuote;
  })();

  inflightQuotes.set(inflightKey, promise);
  try {
    return await promise;
  } finally {
    inflightQuotes.delete(inflightKey);
  }
}

export async function geocodeFlipyAddressForStore(input: {
  agencyId: string;
  storeId: string;
  address: string;
}): Promise<{ address: string; lat: number; lng: number } | null> {
  const query = input.address.trim();
  if (query.length < 4) {
    throw new ValidationError("Dirección demasiado corta para geocodificar.");
  }
  const client = await getFlipyClientForStore(input.agencyId, input.storeId);
  return client.geocodeAddress(query);
}
