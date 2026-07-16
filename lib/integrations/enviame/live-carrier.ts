import "server-only";

import type { CarrierProvider } from "@/lib/integrations/contracts/carrier-provider";
import { providerError } from "@/lib/integrations/contracts/common";
import { fetchEnviameDeliveryTracking } from "@/lib/integrations/enviame/api";
import {
  ENVIAME_MISSING_API_KEY_ERROR,
  getEnviameEnv,
} from "@/lib/integrations/enviame/env";

export type LiveEnviameCredentials = {
  apiKey: string;
  apiBaseUrl?: string;
  companyId?: string | null;
};

/**
 * Live Enviame carrier adapter (S11 first tranche).
 * - health/getTracking use GET /api/s2/v2/deliveries/{id}/tracking
 * - Status updates: webhook → job (no blocking HTTP poll)
 */
export function createLiveCarrierProvider(
  providerId: CarrierProvider["providerId"] = "enviame",
  creds: LiveEnviameCredentials,
): CarrierProvider {
  const env = getEnviameEnv();
  const baseUrl = creds.apiBaseUrl ?? env.apiBaseUrl;

  return {
    providerId,
    mode: "live",
    async connect(input) {
      return {
        ok: true,
        mode: "live",
        externalAccountId: creds.companyId ?? env.companyId ?? "enviame",
        displayName: "Enviame",
        credentialRef: input.credentialRef || "enviame-live",
      };
    },
    async health() {
      const started = Date.now();
      if (!creds.apiKey) {
        return {
          status: "unhealthy",
          mode: "live",
          checkedAt: new Date().toISOString(),
          latencyMs: Date.now() - started,
          message: ENVIAME_MISSING_API_KEY_ERROR,
          demo: false,
        };
      }
      const probe = await fetchEnviameDeliveryTracking({
        identifier: "codtracked-health-probe",
        apiKey: creds.apiKey,
        apiBaseUrl: baseUrl,
      });
      const latencyMs = Date.now() - started;
      if (probe.ok || probe.statusCode === 404 || probe.statusCode === 400) {
        return {
          status: "healthy",
          mode: "live",
          checkedAt: new Date().toISOString(),
          latencyMs,
          message: "Enviame API reachable (GET …/deliveries/{id}/tracking)",
          demo: false,
        };
      }
      if (probe.statusCode === 401 || probe.statusCode === 403) {
        return {
          status: "unhealthy",
          mode: "live",
          checkedAt: new Date().toISOString(),
          latencyMs,
          message: "Enviame API unauthorized — check ENVIAME_API_KEY",
          demo: false,
        };
      }
      return {
        status: "degraded",
        mode: "live",
        checkedAt: new Date().toISOString(),
        latencyMs,
        message: probe.error,
        demo: false,
      };
    },
    async sync() {
      return {
        ok: true,
        mode: "live",
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
      if (!creds.apiKey) {
        throw new Error(ENVIAME_MISSING_API_KEY_ERROR);
      }
      const result = await fetchEnviameDeliveryTracking({
        identifier: trackingNumber,
        apiKey: creds.apiKey,
        apiBaseUrl: baseUrl,
      });
      if (!result.ok) {
        throw Object.assign(new Error(result.error), {
          code: "ENVIAME_TRACKING_FAILED",
          retryable: (result.statusCode ?? 500) >= 500,
          safeMessage: result.error,
        });
      }
      return result.snapshot;
    },
  };
}

export function liveEnviameUnavailableError() {
  return providerError("ENVIAME_NOT_CONFIGURED", ENVIAME_MISSING_API_KEY_ERROR, {
    retryable: false,
  });
}
