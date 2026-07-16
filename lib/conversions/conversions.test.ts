import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { purchaseConversionEventId } from "@/lib/conversions/purchase-event-id";
import { readMetaCapiCredentials, sendMetaCapiPurchase } from "@/lib/conversions/meta-capi";

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

  it("dry-runs Meta CAPI when credentials are missing", async () => {
    const result = await sendMetaCapiPurchase(null, {
      eventId: "purchase:ord-1",
      eventTimeUnix: 1_700_000_000,
      value: 57.95,
      currency: "USD",
      orderId: "ord-1",
    });
    assert.equal(result.mode, "dry_run");
    assert.equal(result.ok, true);
  });
});
