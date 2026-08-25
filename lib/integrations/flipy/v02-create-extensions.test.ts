import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  isFlipyLifecycleWebhookEvent,
  mapFlipyLifecycleWebhookToJobPayload,
  readFlipyWebhookEventType,
} from "@/lib/integrations/flipy/map-lifecycle-webhook";
import { buildFlipyV02CreateExtensions } from "@/lib/integrations/flipy/v02-create-extensions";

describe("v02 create extensions gate", () => {
  it("returns undefined when flipy_v02 disabled (v0.1.1 regression)", () => {
    const ext = buildFlipyV02CreateExtensions({
      v02Enabled: false,
      smartEligible: true,
      operationalMode: "smart",
      packageSize: "mediano",
      fleteQuote: { recommendedFare: 14.5 },
    });
    assert.equal(ext, undefined);
  });

  it("includes smart body when v02 enabled", () => {
    const ext = buildFlipyV02CreateExtensions({
      v02Enabled: true,
      smartEligible: true,
      operationalMode: "smart",
      packageSize: "mediano",
      packageCare: ["fragil"],
      fleteQuote: { recommendedFare: 14.5, version: 2 },
    });
    assert.ok(ext);
    assert.equal(ext?.fulfillmentMode, "smart");
    assert.equal(ext?.priceLocked, true);
    assert.equal(ext?.packageSize, "mediano");
    assert.deepEqual(ext?.packageCare, ["fragil"]);
    assert.equal(ext?.fleteQuote?.recommendedFare, 14.5);
  });

  it("bid mode leaves price editable", () => {
    const ext = buildFlipyV02CreateExtensions({
      v02Enabled: true,
      smartEligible: false,
      operationalMode: "bid",
      packageSize: "grande",
    });
    assert.ok(ext);
    assert.equal(ext?.fulfillmentMode, "bid");
    assert.equal(ext?.priceLocked, false);
  });
});

describe("flipy lifecycle webhook map", () => {
  it("detects v0.2 lifecycle event types", () => {
    assert.equal(readFlipyWebhookEventType({ type: "shipment.created" }), "shipment.created");
    assert.equal(isFlipyLifecycleWebhookEvent("shipment.assigned"), true);
    assert.equal(isFlipyLifecycleWebhookEvent("shipment.status.updated"), false);
  });

  it("maps shipment.assigned with motorizado + carrier sync", () => {
    const mapped = mapFlipyLifecycleWebhookToJobPayload({
      type: "shipment.assigned",
      data: {
        envioId: "clenv1",
        externalOrderId: "shopify:1042",
        estado: "ASIGNADO",
        trackingToken: "cltk1",
        fulfillmentMode: "smart",
        assignedMotorizado: { id: "moto1", displayName: "Juan M.", etaMinutes: 12 },
      },
    });
    assert.equal(mapped.ok, true);
    if (!mapped.ok) return;
    assert.equal(mapped.payload.event_type, "shipment.assigned");
    assert.equal(mapped.payload.assigned_motorizado?.id, "moto1");
    assert.ok(mapped.payload.carrier_payload);
    assert.equal(mapped.payload.carrier_payload?.external_status_code, "ASIGNADO");
  });

  it("maps smart_fallback_to_bid", () => {
    const mapped = mapFlipyLifecycleWebhookToJobPayload({
      type: "shipment.smart_fallback_to_bid",
      data: {
        envioId: "clenv2",
        externalOrderId: "shopify:1043",
        estado: "PENDIENTE_PUJAS",
        trackingToken: "cltk2",
        fulfillmentMode: "bid",
      },
    });
    assert.equal(mapped.ok, true);
    if (!mapped.ok) return;
    assert.equal(mapped.payload.event_type, "shipment.smart_fallback_to_bid");
    assert.equal(mapped.payload.fulfillment_mode, "bid");
  });
});
