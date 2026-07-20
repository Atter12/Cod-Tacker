import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { describe, it } from "node:test";
import { fingerprintEnviaApiToken } from "@/lib/integrations/envia/token-fingerprint";
import { buildEnviaWebhookUrls } from "@/lib/integrations/envia/webhook-urls";
import { resolveEnviaExternalStatusCode } from "@/lib/integrations/envia/map-status";
import { mapEnviaWebhookToJobPayload } from "@/lib/integrations/envia/map-webhook";
import {
  allowEnviaOpenWebhookAuth,
  signEnviaWebhook,
  verifyEnviaWebhookAuth,
} from "@/lib/integrations/envia/webhook-auth";

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

  it("S15: Production rejects when secret unset (401)", () => {
    assert.equal(allowEnviaOpenWebhookAuth({ VERCEL_ENV: "production" }), false);
    const rejected = verifyEnviaWebhookAuth({
      rawBody: "{}",
      webhookSecret: null,
      apiToken: null,
      authorizationHeader: null,
      signatureHeader: null,
      timestampHeader: null,
      eventHeader: null,
      allowOpenWhenSecretUnset: false,
    });
    assert.equal(rejected.ok, false);
    if (rejected.ok) return;
    assert.equal(rejected.status, 401);
    assert.match(rejected.error, /ENVIA_WEBHOOK_SECRET/);
  });

  it("S15: Preview may accept open when secret unset", () => {
    assert.equal(allowEnviaOpenWebhookAuth({ VERCEL_ENV: "preview" }), true);
    const open = verifyEnviaWebhookAuth({
      rawBody: "{}",
      webhookSecret: null,
      apiToken: null,
      authorizationHeader: null,
      signatureHeader: null,
      timestampHeader: null,
      eventHeader: null,
      allowOpenWhenSecretUnset: true,
    });
    assert.equal(open.ok, true);
    if (!open.ok) return;
    assert.equal(open.open, true);
  });

  it("S15: rejects invalid signature with 401 when secret is set", () => {
    const bad = verifyEnviaWebhookAuth({
      rawBody: "{}",
      webhookSecret: "whsec",
      apiToken: null,
      authorizationHeader: null,
      signatureHeader: "v1=deadbeef",
      timestampHeader: "1700000000000",
      eventHeader: "tracking.simple",
    });
    assert.equal(bad.ok, false);
    if (bad.ok) return;
    assert.equal(bad.status, 401);
  });

  it("fingerprints API token stably", () => {
    const a = fingerprintEnviaApiToken("tok-abc");
    const b = fingerprintEnviaApiToken("tok-abc");
    const expected = createHash("sha256").update("tok-abc", "utf8").digest("hex");
    assert.equal(a, b);
    assert.equal(a, expected);
  });

  it("builds global + store webhook URLs", () => {
    const urls = buildEnviaWebhookUrls(
      "holistic-ecommerce",
      "flipy",
      "https://app.codtracked.com/",
    );
    assert.equal(urls.global, "https://app.codtracked.com/api/webhooks/envia");
    assert.equal(
      urls.store,
      "https://app.codtracked.com/api/webhooks/envia/holistic-ecommerce/flipy",
    );
  });
});
