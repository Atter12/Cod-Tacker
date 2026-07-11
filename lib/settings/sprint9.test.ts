import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  generateApiKey,
  hashApiKey,
  sanitizeApiKeyRow,
  verifyApiKey,
  isAllowedScope,
} from "@/lib/api-keys/crypto";
import { parseStoreSettings, storeSettingsUpdateSchema } from "@/lib/settings/store-settings";
import { brandingUpdateSchema, BRANDING_DEFAULTS } from "@/lib/branding/schema";
import { planAllowsWhiteLabel, type PlanLimits } from "@/lib/billing/limits";

describe("api key crypto", () => {
  it("generates prefix + hash and verifies plaintext", () => {
    const key = generateApiKey();
    assert.ok(key.plaintext.startsWith("ctk_"));
    assert.equal(key.keyPrefix.length, 8);
    assert.equal(key.keyHash, hashApiKey(key.plaintext));
    assert.equal(verifyApiKey(key.plaintext, key.keyHash), true);
    assert.equal(verifyApiKey("ctk_deadbeef_wrong", key.keyHash), false);
  });

  it("never exposes key_hash via sanitize", () => {
    const key = generateApiKey();
    const row = {
      id: "1",
      key_hash: key.keyHash,
      key_prefix: key.keyPrefix,
      name: "test",
    };
    const safe = sanitizeApiKeyRow(row);
    assert.equal("key_hash" in safe, false);
    assert.equal(safe.key_prefix, key.keyPrefix);
  });

  it("accepts known scopes only", () => {
    assert.equal(isAllowedScope("orders.read"), true);
    assert.equal(isAllowedScope("admin.all"), false);
  });
});

describe("store settings schema", () => {
  it("parses empty settings with defaults and schema_version", () => {
    const settings = parseStoreSettings({});
    assert.equal(settings.schema_version, 1);
    assert.equal(settings.rto.highRiskThresholdPct, 35);
    assert.equal(settings.cod.assumeCashOnDelivery, true);
  });

  it("validates update payload", () => {
    const parsed = storeSettingsUpdateSchema.safeParse({
      name: "Tienda Demo",
      countryCode: "pe",
      currencyCode: "pen",
      timezone: "America/Lima",
      attributionModel: "last_click",
      attributionWindowDays: 7,
      settings: parseStoreSettings({ demo: { enabled: true } }),
    });
    assert.equal(parsed.success, true);
    if (parsed.success) {
      assert.equal(parsed.data.countryCode, "PE");
      assert.equal(parsed.data.settings.demo.enabled, true);
    }
  });
});

describe("branding schema", () => {
  it("accepts valid hex colors and defaults product name", () => {
    const parsed = brandingUpdateSchema.safeParse({
      productName: BRANDING_DEFAULTS.productName,
      primaryColor: "#0F766E",
      secondaryColor: "#134E4A",
      logoUrl: null,
      faviconUrl: null,
      loginBackgroundUrl: null,
      supportEmail: null,
      supportWhatsapp: null,
      hideCodtrackedBranding: false,
      isWhiteLabelEnabled: false,
    });
    assert.equal(parsed.success, true, parsed.success ? "" : JSON.stringify(parsed.error.issues));
  });

  it("rejects invalid color", () => {
    const parsed = brandingUpdateSchema.safeParse({ primaryColor: "teal" });
    assert.equal(parsed.success, false);
  });

  it("rejects 3-digit hex (DB only allows #RRGGBB)", () => {
    const parsed = brandingUpdateSchema.safeParse({ primaryColor: "#0F7" });
    assert.equal(parsed.success, false);
  });
});

describe("plan white-label gate", () => {
  it("blocks hide branding on starter features", () => {
    const starter: PlanLimits = {
      planId: "1",
      planCode: "starter",
      planName: "Starter",
      storeLimit: 1,
      orderLimit: 300,
      features: { api: false, whatsapp: false, automations: false, white_label: false },
      subscriptionStatus: "trialing",
      cancelAtPeriodEnd: false,
      trialEndsAt: null,
      currentPeriodEnd: null,
      gracePeriodEndsAt: null,
    };
    assert.equal(planAllowsWhiteLabel(starter), false);
    assert.equal(
      planAllowsWhiteLabel({ ...starter, features: { white_label: true } }),
      true,
    );
  });
});
