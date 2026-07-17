import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { resolveEnviaExternalStatusCode } from "@/lib/integrations/envia/map-status";
import { mapEnviaWebhookToJobPayload } from "@/lib/integrations/envia/map-webhook";
import { signEnviaWebhook, verifyEnviaWebhookAuth } from "@/lib/integrations/envia/webhook-auth";

describe("envia webhook / status mapping", () => {
  it("maps Delivered → DELIVERED", () => {
    assert.equal(resolveEnviaExternalStatusCode("Delivered"), "DELIVERED");
    assert.equal(resolveEnviaExternalStatusCode("delivered"), "DELIVERED");
    assert.equal(resolveEnviaExternalStatusCode("Entregado"), "DELIVERED");
  });

  it("maps legacy onShipmentStatusUpdate payload", () => {
    const mapped = mapEnviaWebhookToJobPayload({
      carrierName: "fedex",
      trackingNumber: "100000",
      status: "Delivered",
    });
    assert.equal(mapped.ok, true);
    if (!mapped.ok) return;
    assert.equal(mapped.payload.tracking_number, "100000");
    assert.equal(mapped.payload.external_status_code, "DELIVERED");
    assert.equal(mapped.payload.carrier_code, "envia_com");
    assert.equal(mapped.payload.mode, "live");
  });

  it("maps tracking.simple envelope", () => {
    const mapped = mapEnviaWebhookToJobPayload({
      type: "tracking.simple",
      created_at: "2025-11-12T14:23:05.000Z",
      data: {
        shipment_id: 98765,
        tracking_number: "1Z999AA10123456784",
        carrier_name: "UPS",
        status: "delivered",
        status_description: "Package delivered",
      },
    });
    assert.equal(mapped.ok, true);
    if (!mapped.ok) return;
    assert.equal(mapped.payload.tracking_number, "1Z999AA10123456784");
    assert.equal(mapped.payload.external_status_code, "DELIVERED");
    assert.equal(mapped.payload.external_shipment_id, "98765");
  });

  it("rejects missing tracking", () => {
    const mapped = mapEnviaWebhookToJobPayload({ status: "Delivered" });
    assert.equal(mapped.ok, false);
  });

  it("verifies HMAC signature when secret is set", () => {
    const body = JSON.stringify({ trackingNumber: "1", status: "Delivered" });
    const ts = "1700000000000";
    const event = "tracking.simple";
    const secret = "test-secret";
    const sig = signEnviaWebhook(secret, ts, event, body);
    const ok = verifyEnviaWebhookAuth({
      rawBody: body,
      webhookSecret: secret,
      apiToken: null,
      authorizationHeader: null,
      signatureHeader: sig,
      timestampHeader: ts,
      eventHeader: event,
    });
    assert.equal(ok.ok, true);
  });

  it("accepts Bearer secret", () => {
    const ok = verifyEnviaWebhookAuth({
      rawBody: "{}",
      webhookSecret: "whsec",
      apiToken: null,
      authorizationHeader: "Bearer whsec",
      signatureHeader: null,
      timestampHeader: null,
      eventHeader: null,
    });
    assert.equal(ok.ok, true);
  });
});
