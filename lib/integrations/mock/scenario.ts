import type {
  MockScenario,
  ProviderConnectionResult,
  ProviderError,
  ProviderHealthResult,
  ProviderSyncInput,
  ProviderSyncResult,
} from "@/lib/integrations/contracts/common";
import { providerError } from "@/lib/integrations/contracts/common";

/** Deterministic fixture clock — avoid Math.random for persisted demo data. */
export function mockNowIso(seed = "codtracked-demo"): string {
  // Fixed base + stable hash offset so values are reproducible across runs.
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  const base = Date.UTC(2026, 0, 15, 12, 0, 0);
  return new Date(base + (hash % 86_400_000)).toISOString();
}

export function mockLatencyMs(scenario: MockScenario | undefined): number {
  switch (scenario) {
    case "latency":
      return 2_500;
    case "rate_limit":
      return 800;
    case "degraded":
      return 1_200;
    default:
      return 40;
  }
}

export function errorForScenario(scenario: MockScenario | undefined): ProviderError | null {
  switch (scenario) {
    case "failed":
    case "permanent_error":
      return providerError("PROVIDER_FAILED", "La integración no pudo completar la operación.", {
        retryable: false,
        causeCode: scenario,
      });
    case "rate_limit":
      return providerError("RATE_LIMIT", "Se alcanzó el límite de solicitudes del proveedor.", {
        retryable: true,
        causeCode: scenario,
      });
    case "transient_error":
      return providerError("TRANSIENT_ERROR", "Error temporal del proveedor. Se puede reintentar.", {
        retryable: true,
        causeCode: scenario,
      });
    case "dead_letter":
      return providerError("DEAD_LETTER", "El evento quedó en cola de errores definitivos.", {
        retryable: false,
        causeCode: scenario,
      });
    case "disconnect":
      return providerError("DISCONNECTED", "La conexión con el proveedor está desconectada.", {
        retryable: false,
        causeCode: scenario,
      });
    default:
      return null;
  }
}

export function mockConnectResult(input: {
  externalAccountId: string;
  displayName: string;
  credentialRef: string;
  scenario?: MockScenario;
}): ProviderConnectionResult {
  const error = errorForScenario(input.scenario);
  if (error && input.scenario !== "degraded" && input.scenario !== "retry_success") {
    return { ok: false, mode: "mock", error };
  }
  return {
    ok: true,
    mode: "mock",
    externalAccountId: input.externalAccountId,
    displayName: input.displayName,
    credentialRef: input.credentialRef.startsWith("mock:")
      ? input.credentialRef
      : `mock:${input.credentialRef}`,
  };
}

export function mockHealthResult(scenario?: MockScenario): ProviderHealthResult {
  const latencyMs = mockLatencyMs(scenario);
  if (scenario === "failed" || scenario === "permanent_error" || scenario === "disconnect") {
    return {
      status: scenario === "disconnect" ? "disconnected" : "unhealthy",
      mode: "mock",
      checkedAt: mockNowIso(`health-${scenario}`),
      latencyMs,
      message: "Proveedor mock no saludable (escenario de demostración).",
      demo: true,
    };
  }
  if (scenario === "degraded" || scenario === "rate_limit" || scenario === "latency") {
    return {
      status: "degraded",
      mode: "mock",
      checkedAt: mockNowIso(`health-${scenario ?? "degraded"}`),
      latencyMs,
      message: "Proveedor mock degradado (escenario de demostración).",
      demo: true,
    };
  }
  return {
    status: "healthy",
    mode: "mock",
    checkedAt: mockNowIso("health-ok"),
    latencyMs,
    message: "Proveedor mock saludable.",
    demo: true,
  };
}

export function mockSyncResult(input: ProviderSyncInput): ProviderSyncResult {
  const scenario = input.scenario ?? "success";
  const error = errorForScenario(scenario);
  if (error && scenario !== "retry_success") {
    return {
      ok: false,
      mode: "mock",
      error,
      demo: true,
      deadLetter: scenario === "dead_letter",
    };
  }

  const duplicates = scenario === "duplicate" ? 1 : 0;
  const processed = input.kind === "historical" ? 25 : 5;
  return {
    ok: true,
    mode: "mock",
    processed,
    inserted: Math.max(processed - duplicates, 0),
    updated: scenario === "out_of_order" ? 2 : 0,
    duplicates,
    nextCursor: input.kind === "incremental" ? `mock-cursor-${input.kind}` : null,
    durationMs: mockLatencyMs(scenario),
    demo: true,
  };
}
