import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildFlipyLocationEmbedUrl,
  buildFlipyWalletEmbedUrl,
  buildFlipyOperationWebUrl,
  buildFlipyBidsEmbedUrl,
  ensureFlipyMapWheelZoomParams,
  isAllowedFlipyPostMessageOrigin,
  resolveFlipyScopedEmbedUrl,
  withFlipyLocationClientParams,
  FLIPY_DEFAULT_APP_ORIGIN,
  FLIPY_DEFAULT_EMBED_ORIGIN,
} from "@/lib/integrations/flipy/embed-urls";
import { parseFlipyLocationMessage, parseFlipyWalletToppedUpMessage } from "@/lib/integrations/flipy/post-message";
import {
  mapFlipyWebhookToJobPayload,
  normalizeFlipyOrderExternalId,
} from "@/lib/integrations/flipy/map-webhook";
import { signFlipyWebhook, verifyFlipyWebhookSignature } from "@/lib/integrations/flipy/webhook-auth";

describe("flipy embed-urls", () => {
  it("builds partner ubicacion iframe URL", () => {
    const url = buildFlipyLocationEmbedUrl({
      embedOrigin: FLIPY_DEFAULT_EMBED_ORIGIN,
      token: "jwt-token",
      prefillAddress: "Miraflores, Lima",
      prefillLat: -12.12,
      prefillLng: -77.03,
    });
    assert.match(url, /^https:\/\/flipy-panel\.vercel\.app\/partner\/ubicacion\?/);
    assert.match(url, /token=jwt-token/);
    assert.match(url, /prefillAddress=Miraflores/);
    assert.match(url, /gestureHandling=greedy/);
    assert.match(url, /mapWheel=zoom/);
  });

  it("builds partner recarga iframe URL", () => {
    const url = buildFlipyWalletEmbedUrl({
      embedOrigin: FLIPY_DEFAULT_EMBED_ORIGIN,
      token: "jwt-token",
    });
    assert.match(url, /^https:\/\/flipy-panel\.vercel\.app\/partner\/recarga\?/);
    assert.match(url, /token=jwt-token/);
  });

  it("builds tienda operation web URL for envío", () => {
    const url = buildFlipyOperationWebUrl({
      appOrigin: FLIPY_DEFAULT_APP_ORIGIN,
      envioId: "env123",
    });
    assert.equal(url, "https://tienda.flipyexpress.com/envios/env123");
  });

  it("builds tienda pujas fallback URL", () => {
    const url = buildFlipyOperationWebUrl({ appOrigin: FLIPY_DEFAULT_APP_ORIGIN });
    assert.equal(url, "https://tienda.flipyexpress.com/pujas");
  });

  it("builds partner pujas embed URL", () => {
    const url = buildFlipyBidsEmbedUrl({
      embedOrigin: FLIPY_DEFAULT_EMBED_ORIGIN,
      token: "jwt-token",
      envioId: "env123",
    });
    assert.match(url, /^https:\/\/flipy-panel\.vercel\.app\/partner\/pujas\?/);
    assert.match(url, /token=jwt-token/);
    assert.match(url, /envioId=env123/);
  });

  it("validates postMessage origin against embed origin", () => {
    assert.equal(
      isAllowedFlipyPostMessageOrigin(
        FLIPY_DEFAULT_EMBED_ORIGIN,
        `${FLIPY_DEFAULT_EMBED_ORIGIN}/partner`,
      ),
      true,
    );
    assert.equal(isAllowedFlipyPostMessageOrigin("https://evil.test", FLIPY_DEFAULT_EMBED_ORIGIN), false);
  });

  it("prefers scoped embed URL from Partner API", () => {
    const url = resolveFlipyScopedEmbedUrl({
      scope: "location_picker",
      apiEmbedUrl: `${FLIPY_DEFAULT_EMBED_ORIGIN}/partner/ubicacion?token=abc`,
      embedOrigin: FLIPY_DEFAULT_EMBED_ORIGIN,
      appOrigin: FLIPY_DEFAULT_APP_ORIGIN,
      buildFallback: () => `${FLIPY_DEFAULT_EMBED_ORIGIN}/partner/ubicacion?token=fallback`,
    });
    assert.equal(url, `${FLIPY_DEFAULT_EMBED_ORIGIN}/partner/ubicacion?token=abc`);
  });

  it("rewrites tienda app host embeds onto FLIPY_EMBED_ORIGIN", () => {
    const url = resolveFlipyScopedEmbedUrl({
      scope: "location_picker",
      apiEmbedUrl: `${FLIPY_DEFAULT_APP_ORIGIN}/partner/ubicacion?token=abc&lat=-12.1`,
      embedOrigin: FLIPY_DEFAULT_EMBED_ORIGIN,
      appOrigin: FLIPY_DEFAULT_APP_ORIGIN,
      buildFallback: () => `${FLIPY_DEFAULT_EMBED_ORIGIN}/partner/ubicacion?token=fallback`,
    });
    assert.equal(
      url,
      `${FLIPY_DEFAULT_EMBED_ORIGIN}/partner/ubicacion?token=abc&lat=-12.1`,
    );
  });

  it("ensures greedy map wheel params on ubicacion URLs", () => {
    const url = ensureFlipyMapWheelZoomParams(
      `${FLIPY_DEFAULT_EMBED_ORIGIN}/partner/ubicacion?token=abc`,
    );
    assert.match(url, /gestureHandling=greedy/);
    assert.match(url, /mapWheel=zoom/);
  });

  it("requests live pin sync + parentOrigin on ubicacion iframe", () => {
    const url = withFlipyLocationClientParams(
      `${FLIPY_DEFAULT_EMBED_ORIGIN}/partner/ubicacion?token=abc`,
      "https://app.codtracked.com",
      { liveSync: true },
    );
    assert.match(url, /liveLocationSync=1/);
    assert.match(url, /parentOrigin=https%3A%2F%2Fapp\.codtracked\.com/);
  });

  it("uses standalone embed mode by default (modal UX)", () => {
    const url = withFlipyLocationClientParams(
      `${FLIPY_DEFAULT_EMBED_ORIGIN}/partner/ubicacion?token=abc`,
      "https://app.codtracked.com",
    );
    assert.match(url, /embedMode=standalone/);
    assert.doesNotMatch(url, /liveLocationSync=1/);
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

  it("parses nested location payload and latitude aliases", () => {
    const msg = parseFlipyLocationMessage({
      type: "flipy-location-confirmed",
      payload: { direccion: "Av. Larco 1", latitude: -12.12, longitude: -77.03 },
    });
    assert.ok(msg);
    assert.equal(msg?.address, "Av. Larco 1");
    assert.equal(msg?.lat, -12.12);
    assert.equal(msg?.lng, -77.03);
  });

  it("parses live pin drag as provisional location-updated", () => {
    const msg = parseFlipyLocationMessage({
      type: "flipy-location-updated",
      address: "Perú",
      lat: -12.1226,
      lng: -77.01936,
    });
    assert.ok(msg);
    assert.equal(msg?.provisional, true);
    assert.equal(msg?.address, "Perú");
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

describe("flipy lifecycle webhook ingress types", () => {
  it("routes lifecycle event type strings", async () => {
    const { readFlipyWebhookEventType, isFlipyLifecycleWebhookEvent } = await import(
      "@/lib/integrations/flipy/map-lifecycle-webhook"
    );
    assert.equal(readFlipyWebhookEventType({ type: "shipment.created" }), "shipment.created");
    assert.equal(isFlipyLifecycleWebhookEvent("shipment.smart_fallback_to_bid"), true);
    assert.equal(isFlipyLifecycleWebhookEvent("shipment.status.updated"), false);
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
