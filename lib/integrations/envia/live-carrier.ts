import "server-only";

import type { CarrierProvider } from "@/lib/integrations/contracts/carrier-provider";
import {
  ENVIA_MISSING_TOKEN_ERROR,
  getEnviaEnv,
} from "@/lib/integrations/envia/env";

export type LiveEnviaCredentials = {
  apiToken: string;
  apiBaseUrl?: string;
};

/**
 * Live Envia.com carrier adapter.
 * Status updates: webhook → job (primary path).
 * Health: lightweight authenticated GET against Queries API countries list.
 */
export function createLiveEnviaCarrierProvider(
  providerId: CarrierProvider["providerId"] = "envia_com",
  creds: LiveEnviaCredentials,
): CarrierProvider {
  const env = getEnviaEnv();
  const apiBase = (creds.apiBaseUrl ?? env.apiBaseUrl).replace(/\/$/, "");
  // Queries host mirrors shipping host: api → queries, api-test → queries-test
  const queriesBase = apiBase.includes("api-test")
    ? "https://queries-test.envia.com"
    : apiBase.includes("api.envia.com")
      ? "https://queries.envia.com"
      : apiBase.replace("://api.", "://queries.");

  return {
    providerId,
    mode: "live",
    async connect(input) {
      return {
        ok: true,
        mode: "live",
        externalAccountId: input.credentialRef?.startsWith("envia:")
          ? input.credentialRef
          : "envia_com",
        displayName: "Envia.com",
        credentialRef: input.credentialRef || "envia-live",
      };
    },
    async health() {
      const started = Date.now();
      if (!creds.apiToken) {
        return {
          status: "unhealthy",
          mode: "live",
          checkedAt: new Date().toISOString(),
          latencyMs: Date.now() - started,
          message: ENVIA_MISSING_TOKEN_ERROR,
          demo: false,
        };
      }
      try {
        const res = await fetch(`${queriesBase}/country`, {
          method: "GET",
          headers: {
            Authorization: `Bearer ${creds.apiToken}`,
            Accept: "application/json",
          },
        });
        const latencyMs = Date.now() - started;
        if (res.ok || res.status === 404) {
          return {
            status: "healthy",
            mode: "live",
            checkedAt: new Date().toISOString(),
            latencyMs,
            message: "Envia.com API reachable",
            demo: false,
          };
        }
        if (res.status === 401 || res.status === 403) {
          return {
            status: "unhealthy",
            mode: "live",
            checkedAt: new Date().toISOString(),
            latencyMs,
            message: "Envia.com unauthorized — check ENVIA_API_TOKEN",
            demo: false,
          };
        }
        return {
          status: "degraded",
          mode: "live",
          checkedAt: new Date().toISOString(),
          latencyMs,
          message: `Envia.com HTTP ${res.status}`,
          demo: false,
        };
      } catch (err) {
        return {
          status: "unhealthy",
          mode: "live",
          checkedAt: new Date().toISOString(),
          latencyMs: Date.now() - started,
          message: err instanceof Error ? err.message : "envia_network_error",
          demo: false,
        };
      }
    },
    async sync() {
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
  };
}
