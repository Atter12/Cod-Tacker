import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  INTEGRATION_CATALOG,
  isStoreIntegrationProvider,
  labelHealthStatus,
  labelSyncStatus,
  labelSyncType,
} from "./catalog";
import { mockHealthResult, mockSyncResult } from "./mock/scenario";
import { createMockAdsProvider } from "./mock/ads.mock";
import { createMockCarrierProvider } from "./mock/carrier.mock";
import { createMockCommerceProvider } from "./mock/commerce.mock";
import { createMockMessagingProvider } from "./mock/messaging.mock";

describe("integration sync flow shapes", () => {
  it("exposes the store catalog providers used by Sprint 2 UI", () => {
    assert.ok(INTEGRATION_CATALOG.length >= 5);
    assert.equal(isStoreIntegrationProvider("shopify"), true);
    assert.equal(isStoreIntegrationProvider("custom_payment"), false);
    assert.equal(isStoreIntegrationProvider("other"), false);
  });

  it("maps incremental sync results into persisted-friendly totals", () => {
    const result = mockSyncResult({ kind: "incremental", scenario: "success" });
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.ok(result.processed > 0);
    assert.ok(result.inserted >= 0);
    assert.ok(result.updated >= 0);
    assert.ok(result.duplicates >= 0);
    assert.equal(result.demo, true);
  });

  it("maps historical/backfill sync to a larger processed count", () => {
    const incremental = mockSyncResult({ kind: "incremental", scenario: "success" });
    const historical = mockSyncResult({ kind: "historical", scenario: "success" });
    assert.equal(incremental.ok && historical.ok, true);
    if (incremental.ok && historical.ok) {
      assert.ok(historical.processed > incremental.processed);
    }
  });

  it("keeps health probe messages safe for UI", () => {
    const healthy = mockHealthResult("success");
    assert.equal(healthy.status, "healthy");
    assert.ok(healthy.message.length > 0);
    assert.equal(healthy.demo, true);

    const down = mockHealthResult("failed");
    assert.equal(down.status, "unhealthy");
    assert.match(down.message, /mock/i);
  });

  it("labels sync/health statuses in Spanish for operations UI", () => {
    assert.equal(labelSyncStatus("completed"), "Completado");
    assert.equal(labelSyncStatus("failed"), "Fallido");
    assert.equal(labelSyncType("backfill"), "Backfill");
    assert.equal(labelHealthStatus("down"), "Caído");
  });

  it("resolves sync() on every catalog provider kind", async () => {
    const providers = [
      createMockCommerceProvider("shopify"),
      createMockAdsProvider("meta"),
      createMockAdsProvider("tiktok"),
      createMockMessagingProvider("whatsapp"),
      createMockCarrierProvider("enviame"),
      createMockCarrierProvider("custom_carrier"),
    ];

    for (const provider of providers) {
      const result = await provider.sync({ kind: "incremental", scenario: "success" });
      assert.equal(result.ok, true);
      if (result.ok) {
        assert.equal(result.mode, "mock");
        assert.equal(result.demo, true);
      }
    }
  });

  it("surfaces failed sync without leaking internal cause codes to the result root", () => {
    const result = mockSyncResult({ kind: "incremental", scenario: "permanent_error" });
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.error.code, "PROVIDER_FAILED");
      assert.ok(result.error.safeMessage);
      assert.equal("causeCode" in result.error && typeof result.error.causeCode === "string", true);
    }
  });
});
