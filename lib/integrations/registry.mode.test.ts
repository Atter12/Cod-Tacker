import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import {
  areMockIntegrationsEnabled,
  resolveIntegrationMode,
  type ServerEnv,
} from "../../config/env";

function baseEnv(overrides: Partial<ServerEnv> = {}): ServerEnv {
  return {
    NEXT_PUBLIC_APP_URL: "http://localhost:3000",
    NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
    NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon-test-key",
    NEXT_PUBLIC_DEFAULT_LOCALE: "es-PE",
    NEXT_PUBLIC_DEFAULT_TIMEZONE: "America/Lima",
    ...overrides,
  };
}

describe("resolveIntegrationMode", () => {
  const previousNodeEnv = process.env.NODE_ENV;

  afterEach(() => {
    Object.defineProperty(process.env, "NODE_ENV", {
      value: previousNodeEnv,
      configurable: true,
      writable: true,
      enumerable: true,
    });
  });

  function setNodeEnv(value: string) {
    Object.defineProperty(process.env, "NODE_ENV", {
      value,
      configurable: true,
      writable: true,
      enumerable: true,
    });
  }

  it("defaults to mock outside production", () => {
    setNodeEnv("development");
    const env = baseEnv({ INTEGRATION_MODE: undefined });
    assert.equal(resolveIntegrationMode(env), "mock");
    assert.equal(areMockIntegrationsEnabled(env), true);
  });

  it("honors explicit live mode", () => {
    setNodeEnv("development");
    const env = baseEnv({ INTEGRATION_MODE: "live" });
    assert.equal(resolveIntegrationMode(env), "live");
  });

  it("requires explicit mode in production", () => {
    setNodeEnv("production");
    const env = baseEnv({ INTEGRATION_MODE: undefined });
    assert.throws(() => resolveIntegrationMode(env), /INTEGRATION_MODE/);
  });
});
