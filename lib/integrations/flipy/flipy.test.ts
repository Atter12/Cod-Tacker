import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  mapFlipyWebhookToJobPayload,
  normalizeFlipyOrderExternalId,
} from "@/lib/integrations/flipy/map-webhook";
import { signFlipyWebhook, verifyFlipyWebhookSignature } from "@/lib/integrations/flipy/webhook-auth";

describe("flipy map-webhook", () => {
  it("maps nested partner webhook payload", () => {
    const mapped = mapFlipyWebhookToJobPayload({
      type: "shipment.status.updated",
      data: {
        envioId: "clenv123",
        externalOrderId: "shopify:7123456789",
        estado: "EN_CURSO",
        trackingToken: "cltk999",
        trackingUrl: "https://app.flipy.pe/rastreo/cltk999",
        escenarioPago: "1E",
      },
    });
    assert.equal(mapped.ok, true);
    if (!mapped.ok) return;
    assert.equal(mapped.payload.carrier_code, "flipy");
    assert.equal(mapped.payload.tracking_number, "cltk999");
    assert.equal(mapped.payload.external_status_code, "EN_CURSO");
    assert.equal(mapped.payload.order_external_id, "7123456789");
    assert.equal(mapped.payload.external_shipment_id, "clenv123");
  });

  it("normalizes shopify external order ids", () => {
    assert.equal(normalizeFlipyOrderExternalId("shopify:1042"), "1042");
    assert.equal(normalizeFlipyOrderExternalId("1042"), "1042");
  });
});

describe("flipy webhook-auth", () => {
  it("verifies sha256 HMAC signature", () => {
    const body = JSON.stringify({ test: true });
    const secret = "test-secret";
    const sig = signFlipyWebhook(secret, body);
    assert.equal(verifyFlipyWebhookSignature(body, sig, secret), true);
    assert.equal(verifyFlipyWebhookSignature(body, "sha256=bad", secret), false);
  });
});
