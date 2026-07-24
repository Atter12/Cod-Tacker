import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { adsSpendRawMetricsSource } from "@/lib/jobs/handlers/ads-spend-synced";

describe("adsSpendRawMetricsSource", () => {
  it("tags live Meta and TikTok rows with the correct Insights source", () => {
    assert.equal(adsSpendRawMetricsSource("meta", true), "meta_insights");
    assert.equal(adsSpendRawMetricsSource("tiktok", true), "tiktok_insights");
  });

  it("tags mock rows as mock_sync for both platforms", () => {
    assert.equal(adsSpendRawMetricsSource("meta", false), "mock_sync");
    assert.equal(adsSpendRawMetricsSource("tiktok", false), "mock_sync");
  });
});
