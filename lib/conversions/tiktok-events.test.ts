import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { purchaseConversionEventId } from "@/lib/conversions/purchase-event-id";
import {
  TIKTOK_EVENTS_MISSING_CREDENTIALS_ERROR,
  buildTikTokEventsUser,
  hashTikTokEventsValue,
  normalizeTikTokEmail,
  readTikTokEventsCredentials,
  readTikTokEventsCredentialsFromEnv,
  resolveTikTokEventsCredentials,
  sendTikTokEventsPurchase,
} from "@/lib/conversions/tiktok-events";

describe("tiktok events (S12)", () => {
  it("reads TikTok credentials from integration settings", () => {
    const creds = readTikTokEventsCredentials(
      {
        pixel_code: "PX123",
        access_token: "tok_tt",
        test_event_code: "TEST_TT",
      },
      null,
    );
    assert.deepEqual(creds, {
      pixelCode: "PX123",
      accessToken: "tok_tt",
      testEventCode: "TEST_TT",
    });
  });

  it("accepts pixel_id alias and prefers integration over env", () => {
    const prevPixel = process.env.TIKTOK_PIXEL_ID;
    const prevToken = process.env.TIKTOK_ACCESS_TOKEN;
    process.env.TIKTOK_PIXEL_ID = "env_px";
    process.env.TIKTOK_ACCESS_TOKEN = "env_tok";
    try {
      const creds = resolveTikTokEventsCredentials(
        { pixel_id: "bag_px", access_token: "bag_tok" },
        null,
      );
      assert.equal(creds?.pixelCode, "bag_px");
      assert.equal(creds?.source, "integration");
    } finally {
      if (prevPixel === undefined) delete process.env.TIKTOK_PIXEL_ID;
      else process.env.TIKTOK_PIXEL_ID = prevPixel;
      if (prevToken === undefined) delete process.env.TIKTOK_ACCESS_TOKEN;
      else process.env.TIKTOK_ACCESS_TOKEN = prevToken;
    }
  });

  it("falls back to env when integration settings lack credentials", () => {
    const prevPixel = process.env.TIKTOK_PIXEL_ID;
    const prevToken = process.env.TIKTOK_ACCESS_TOKEN;
    process.env.TIKTOK_PIXEL_ID = "env_px";
    process.env.TIKTOK_ACCESS_TOKEN = "env_tok";
    try {
      const creds = resolveTikTokEventsCredentials({}, null);
      assert.deepEqual(creds, {
        pixelCode: "env_px",
        accessToken: "env_tok",
        testEventCode: null,
        source: "env",
      });
    } finally {
      if (prevPixel === undefined) delete process.env.TIKTOK_PIXEL_ID;
      else process.env.TIKTOK_PIXEL_ID = prevPixel;
      if (prevToken === undefined) delete process.env.TIKTOK_ACCESS_TOKEN;
      else process.env.TIKTOK_ACCESS_TOKEN = prevToken;
    }
  });

  it("returns null from env helper when either var is missing", () => {
    const prevPixel = process.env.TIKTOK_PIXEL_ID;
    const prevToken = process.env.TIKTOK_ACCESS_TOKEN;
    const prevCode = process.env.TIKTOK_PIXEL_CODE;
    delete process.env.TIKTOK_PIXEL_ID;
    delete process.env.TIKTOK_PIXEL_CODE;
    delete process.env.TIKTOK_ACCESS_TOKEN;
    try {
      assert.equal(readTikTokEventsCredentialsFromEnv(), null);
      process.env.TIKTOK_PIXEL_ID = "only_pixel";
      assert.equal(readTikTokEventsCredentialsFromEnv(), null);
    } finally {
      if (prevPixel === undefined) delete process.env.TIKTOK_PIXEL_ID;
      else process.env.TIKTOK_PIXEL_ID = prevPixel;
      if (prevCode === undefined) delete process.env.TIKTOK_PIXEL_CODE;
      else process.env.TIKTOK_PIXEL_CODE = prevCode;
      if (prevToken === undefined) delete process.env.TIKTOK_ACCESS_TOKEN;
      else process.env.TIKTOK_ACCESS_TOKEN = prevToken;
    }
  });

  it("dry_runs when credentials are missing (S12)", async () => {
    const result = await sendTikTokEventsPurchase(null, {
      eventId: "purchase:ord-1",
      eventTimeIso: "2026-07-17T12:00:00.000Z",
      value: 57.95,
      currency: "PEN",
      orderId: "ord-1",
    });
    assert.equal(result.mode, "dry_run");
    assert.equal(result.ok, true);
    assert.equal(result.error, TIKTOK_EVENTS_MISSING_CREDENTIALS_ERROR);
    assert.equal(
      (result.body as { event_id?: string } | undefined)?.event_id,
      "purchase:ord-1",
    );
  });

  it("builds hashed TikTok user with external_id and shared purchase event_id for dedupe", () => {
    const eventId = purchaseConversionEventId("ord-1");
    assert.equal(eventId, "purchase:ord-1");
    assert.equal(purchaseConversionEventId("ord-1"), purchaseConversionEventId("ord-1"));

    const user = buildTikTokEventsUser({
      eventId,
      eventTimeIso: "2026-07-17T12:00:00.000Z",
      value: 10,
      currency: "PEN",
      orderId: "ord-1",
      email: "  User@Example.COM ",
      phone: "+51 999 888 777",
    });
    assert.equal(user.external_id, hashTikTokEventsValue("ord-1"));
    assert.equal(user.email, hashTikTokEventsValue(normalizeTikTokEmail("User@Example.COM")));
    assert.ok(user.phone_number);
  });
});
