/**
 * Shared provider contract types for mock and future live adapters.
 * UI and domain code must not branch on provider implementation details.
 */

export type IntegrationRuntimeMode = "mock" | "live";

/**
 * Deterministic scenarios the mock layer can simulate.
 * Prefer seeded fixtures over Math.random for persisted demo data.
 */
export type MockScenario =
  | "success"
  | "degraded"
  | "failed"
  | "latency"
  | "rate_limit"
  | "duplicate"
  | "out_of_order"
  | "transient_error"
  | "permanent_error"
  | "retry_success"
  | "dead_letter"
  | "disconnect"
  | "reconnect";

export type ProviderError = {
  code: string;
  retryable: boolean;
  safeMessage: string;
  /** Internal detail for logs only — never send to the client. */
  causeCode?: string;
};

export type ProviderConnectionResult =
  | {
      ok: true;
      mode: IntegrationRuntimeMode;
      externalAccountId: string;
      displayName: string;
      /** Non-sensitive connection reference (never a real token). */
      credentialRef: string;
    }
  | {
      ok: false;
      mode: IntegrationRuntimeMode;
      error: ProviderError;
    };

export type ProviderHealthStatus = "healthy" | "degraded" | "unhealthy" | "disconnected";

export type ProviderHealthResult = {
  status: ProviderHealthStatus;
  mode: IntegrationRuntimeMode;
  checkedAt: string;
  latencyMs: number;
  message: string;
  demo: boolean;
};

export type ProviderSyncKind = "incremental" | "historical";

export type ProviderSyncInput = {
  kind: ProviderSyncKind;
  cursor?: string | null;
  from?: string | null;
  to?: string | null;
  scenario?: MockScenario;
};

export type ProviderSyncResult =
  | {
      ok: true;
      mode: IntegrationRuntimeMode;
      processed: number;
      inserted: number;
      updated: number;
      duplicates: number;
      nextCursor: string | null;
      durationMs: number;
      demo: boolean;
    }
  | {
      ok: false;
      mode: IntegrationRuntimeMode;
      error: ProviderError;
      demo: boolean;
      deadLetter?: boolean;
    };

export function providerError(
  code: string,
  safeMessage: string,
  options: { retryable?: boolean; causeCode?: string } = {},
): ProviderError {
  return {
    code,
    safeMessage,
    retryable: options.retryable ?? false,
    causeCode: options.causeCode,
  };
}
