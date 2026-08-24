import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildFlipyLocationEmbedUrl,
  buildFlipyWalletEmbedUrl,
  buildFlipyOperationWebUrl,
  buildFlipyBidsEmbedUrl,
  isAllowedFlipyPostMessageOrigin,
} from "@/lib/integrations/flipy/embed-urls";
import { parseFlipyWalletToppedUpMessage } from "@/lib/integrations/flipy/post-message";
import {
  mapFlipyWebhookToJobPayload,
  normalizeFlipyOrderExternalId,
} from "@/lib/integrations/flipy/map-webhook";
import { signFlipyWebhook, verifyFlipyWebhookSignature } from "@/lib/integrations/flipy/webhook-auth";

describe("flipy embed-urls", () => {
  it("builds partner ubicacion iframe URL", () => {
    const url = buildFlipyLocationEmbedUrl({
      embedOrigin: "https://app.flipy.pe",
      token: "jwt-token",
      prefillAddress: "Miraflores, Lima",
      prefillLat: -12.12,
      prefillLng: -77.03,
    });
    assert.match(url, /^https:\/\/app\.flipy\.pe\/partner\/ubicacion\?/);
    assert.match(url, /token=jwt-token/);
    assert.match(url, /prefillAddress=Miraflores/);
  });

  it("builds partner recarga iframe URL", () => {
    const url = buildFlipyWalletEmbedUrl({
      embedOrigin: "https://app.flipy.pe",
      token: "jwt-token",
    });
    assert.match(url, /^https:\/\/app\.flipy\.pe\/partner\/recarga\?/);
    assert.match(url, /token=jwt-token/);
  });

  it("builds tienda operation web URL for envío", () => {
    const url = buildFlipyOperationWebUrl({
      appOrigin: "https://tienda.flipyexpress.com",
      envioId: "env123",
    });
    assert.equal(url, "https://tienda.flipyexpress.com/envios/env123");
  });

  it("builds tienda pujas fallback URL", () => {
    const url = buildFlipyOperationWebUrl({ appOrigin: "https://tienda.flipyexpress.com" });
    assert.equal(url, "https://tienda.flipyexpress.com/pujas");
  });

  it("builds partner pujas embed URL", () => {
    const url = buildFlipyBidsEmbedUrl({
      embedOrigin: "https://app.flipy.pe",
      token: "jwt-token",
      envioId: "env123",
    });
    assert.match(url, /^https:\/\/app\.flipy\.pe\/partner\/pujas\?/);
    assert.match(url, /token=jwt-token/);
    assert.match(url, /envioId=env123/);
  });

  it("validates postMessage origin against embed origin", () => {
    assert.equal(
      isAllowedFlipyPostMessageOrigin("https://app.flipy.pe", "https://app.flipy.pe/partner"),
      true,
    );
    assert.equal(isAllowedFlipyPostMessageOrigin("https://evil.test", "https://app.flipy.pe"), false);
  });
});

describe("flipy post-message", () => {
  it("parses wallet topped up message", () => {
    const parsed = parseFlipyWalletToppedUpMessage({
      type: "flipy-wallet-topped-up",
      newBalance: 150.5,
    });
    assert.ok(parsed);
    assert.equal(parsed?.newBalance, 150.5);
  });
});

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
