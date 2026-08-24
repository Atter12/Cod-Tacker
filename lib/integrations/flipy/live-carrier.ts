import "server-only";

import type { CarrierProvider } from "@/lib/integrations/contracts/carrier-provider";
import {
  createFlipyPartnerClient,
  type FlipyPartnerClientConfig,
} from "@/lib/integrations/flipy/client";
import { FLIPY_MISSING_PARTNER_KEY_ERROR, getFlipyEnv } from "@/lib/integrations/flipy/env";

export type LiveFlipyCredentials = {
  partnerApiKey: string;
  flipyTiendaId: string;
  externalStoreId: string;
  apiBaseUrl?: string;
  partnerId?: string;
};

export function createLiveFlipyCarrierProvider(
  providerId: CarrierProvider["providerId"] = "flipy",
  creds: LiveFlipyCredentials,
): CarrierProvider {
  const env = getFlipyEnv();
  const clientConfig: FlipyPartnerClientConfig = {
    baseUrl: creds.apiBaseUrl ?? env.apiBaseUrl,
    partnerKey: creds.partnerApiKey,
    partnerId: creds.partnerId ?? env.partnerId,
    externalStoreId: creds.externalStoreId,
  };
  const client = createFlipyPartnerClient(clientConfig);

  return {
    providerId,
    mode: "live",
    async connect(input) {
      return {
        ok: true,
        mode: "live",
        externalAccountId: creds.flipyTiendaId,
        displayName: "Flipy",
        credentialRef: input.credentialRef || `flipy:${creds.flipyTiendaId}`,
      };
    },
    async health() {
      const started = Date.now();
      if (!creds.partnerApiKey || !creds.flipyTiendaId) {
        return {
          status: "unhealthy",
          mode: "live",
          checkedAt: new Date().toISOString(),
          latencyMs: Date.now() - started,
          message: FLIPY_MISSING_PARTNER_KEY_ERROR,
          demo: false,
        };
      }
      try {
        const saldo = await client.getSaldo(creds.flipyTiendaId);
        const latencyMs = Date.now() - started;
        return {
          status: saldo.warningBajo ? "degraded" : "healthy",
          mode: "live",
          checkedAt: new Date().toISOString(),
          latencyMs,
          message: `Saldo operaciones: ${saldo.saldoOperaciones.toFixed(2)} PEN`,
          demo: false,
        };
      } catch (error) {
        return {
          status: "unhealthy",
          mode: "live",
          checkedAt: new Date().toISOString(),
          latencyMs: Date.now() - started,
          message: error instanceof Error ? error.message : "Flipy health check failed",
          demo: false,
        };
      }
    },
    async sync(input) {
      return {
        ok: true,
        mode: "live" as const,
        processed: 0,
        inserted: 0,
        updated: 0,
        duplicates: 0,
        nextCursor: null,
        durationMs: 0,
        demo: false,
        enqueues: [],
      };
    },
    async getTracking(trackingNumber) {
      return {
        trackingNumber,
        status: "unknown",
        occurredAt: new Date().toISOString(),
        description: "Tracking vía webhook Flipy",
      };
    },
  };
}
