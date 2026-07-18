import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { purchaseConversionEventId } from "@/lib/conversions/purchase-event-id";
import {
  META_CAPI_MISSING_CREDENTIALS_ERROR,
  readMetaCapiCredentials,
  readMetaCapiCredentialsFromEnv,
  resolveMetaCapiCredentials,
  sendMetaCapiPurchase,
} from "@/lib/conversions/meta-capi";

describe("purchase conversion helpers", () => {
  it("builds stable purchase event ids", () => {
    assert.equal(purchaseConversionEventId("ord-1"), "purchase:ord-1");
  });

  it("reads Meta CAPI credentials from settings", () => {
    const creds = readMetaCapiCredentials(
      { pixel_id: "px_1", capi_access_token: "tok_1", test_event_code: "TEST123" },
      null,
    );
    assert.deepEqual(creds, {
      pixelId: "px_1",
      accessToken: "tok_1",
      testEventCode: "TEST123",
    });
  });

  it("prefers integration settings over env when resolving", () => {
    const prevPixel = process.env.META_PIXEL_ID;
    const prevToken = process.env.META_CAPI_ACCESS_TOKEN;
    process.env.META_PIXEL_ID = "env_pixel";
    process.env.META_CAPI_ACCESS_TOKEN = "env_token";
    try {
      const creds = resolveMetaCapiCredentials(
        { pixel_id: "bag_pixel", capi_access_token: "bag_token" },
        null,
      );
      assert.equal(creds?.pixelId, "bag_pixel");
      assert.equal(creds?.source, "integration");
    } finally {
      if (prevPixel === undefined) delete process.env.META_PIXEL_ID;
      else process.env.META_PIXEL_ID = prevPixel;
      if (prevToken === undefined) delete process.env.META_CAPI_ACCESS_TOKEN;
      else process.env.META_CAPI_ACCESS_TOKEN = prevToken;
    }
  });

  it("falls back to env when integration settings lack credentials", () => {
    const prevPixel = process.env.META_PIXEL_ID;
    const prevToken = process.env.META_CAPI_ACCESS_TOKEN;
    process.env.META_PIXEL_ID = "env_pixel";
    process.env.META_CAPI_ACCESS_TOKEN = "env_token";
    try {
      const creds = resolveMetaCapiCredentials({}, null);
      assert.deepEqual(creds, {
        pixelId: "env_pixel",
        accessToken: "env_token",
        testEventCode: null,
        source: "env",
      });
    } finally {
      if (prevPixel === undefined) delete process.env.META_PIXEL_ID;
      else process.env.META_PIXEL_ID = prevPixel;
      if (prevToken === undefined) delete process.env.META_CAPI_ACCESS_TOKEN;
      else process.env.META_CAPI_ACCESS_TOKEN = prevToken;
    }
  });

  it("returns null from env helper when either var is missing", () => {
    const prevPixel = process.env.META_PIXEL_ID;
    const prevToken = process.env.META_CAPI_ACCESS_TOKEN;
    delete process.env.META_PIXEL_ID;
    delete process.env.META_CAPI_ACCESS_TOKEN;
    try {
      assert.equal(readMetaCapiCredentialsFromEnv(), null);
      process.env.META_PIXEL_ID = "only_pixel";
      assert.equal(readMetaCapiCredentialsFromEnv(), null);
    } finally {
      if (prevPixel === undefined) delete process.env.META_PIXEL_ID;
      else process.env.META_PIXEL_ID = prevPixel;
      if (prevToken === undefined) delete process.env.META_CAPI_ACCESS_TOKEN;
      else process.env.META_CAPI_ACCESS_TOKEN = prevToken;
    }
  });

  it("fails clearly when credentials are missing (no dry_run)", async () => {
    const result = await sendMetaCapiPurchase(null, {
      eventId: "purchase:ord-1",
      eventTimeUnix: 1_700_000_000,
      value: 57.95,
      currency: "USD",
      orderId: "ord-1",
    });
    assert.equal(result.mode, "live");
    assert.equal(result.ok, false);
    assert.equal(result.error, META_CAPI_MISSING_CREDENTIALS_ERROR);
  });

  it("builds hashed Meta user_data with external_id always present", async () => {
    const { buildMetaCapiUserData, hashMetaCapiValue, normalizeMetaEmail } = await import(
      "@/lib/conversions/meta-capi"
    );
    const userData = buildMetaCapiUserData({
      eventId: "purchase:ord-1",
      eventTimeUnix: 1,
      value: 10,
      currency: "USD",
      orderId: "ord-1",
      email: "  User@Example.COM ",
      phone: "+51 999 888 777",
      countryCode: "PE",
      city: "Lima",
    });
    assert.equal(userData.external_id, hashMetaCapiValue("ord-1"));
    assert.equal(userData.em, hashMetaCapiValue(normalizeMetaEmail("User@Example.COM")));
    assert.ok(userData.ph);
    assert.equal(userData.country, "pe");
    assert.ok(userData.ct);
    assert.equal(userData.em_present, undefined);
  });

  it("keeps purchase event_id stable for Meta dedupe", () => {
    assert.equal(purchaseConversionEventId("abc"), purchaseConversionEventId("abc"));
    assert.notEqual(purchaseConversionEventId("a"), purchaseConversionEventId("b"));
  });
});
