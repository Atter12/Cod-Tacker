import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { errorForScenario, mockSyncResult } from "../mock/scenario";
import { createMockCommerceProvider } from "../mock/commerce.mock";
import { providerError } from "../contracts/common";

describe("mock provider scenarios", () => {
  it("builds normalized provider errors", () => {
    const err = providerError("RATE_LIMIT", "Límite alcanzado", { retryable: true });
    assert.equal(err.code, "RATE_LIMIT");
    assert.equal(err.retryable, true);
  });

  it("marks transient failures as retryable", () => {
    const err = errorForScenario("transient_error");
    assert.ok(err);
    assert.equal(err!.retryable, true);
  });

  it("returns deterministic successful sync for mock commerce", async () => {
    const provider = createMockCommerceProvider("shopify");
    assert.equal(provider.mode, "mock");
    const result = await provider.sync({ kind: "incremental", scenario: "success" });
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.equal(result.demo, true);
      assert.equal(result.mode, "mock");
      assert.ok(result.processed > 0);
    }
  });

  it("simulates dead-letter sync failures", () => {
    const result = mockSyncResult({ kind: "incremental", scenario: "dead_letter" });
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.deadLetter, true);
      assert.equal(result.demo, true);
    }
  });
});
