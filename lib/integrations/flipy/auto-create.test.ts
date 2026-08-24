import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildOrderShippingAddress,
  evaluateFlipyAutoCreate,
  readOrderDestinationCoords,
} from "@/lib/integrations/flipy/auto-create";
import type { FlipyPaymentResolution } from "@/lib/integrations/flipy/resolve-payment";

const basePayment: FlipyPaymentResolution = {
  fulfillmentMode: "delivery",
  productPaidAtCheckout: false,
  shippingPaidAtCheckout: false,
  suggestedEscenario: "1E",
  codAmount: 89,
  suggestedFlete: 15,
  confidence: "high",
  requiresUserConfirmation: false,
  reasons: ["cod_default"],
};

describe("flipy auto-create rules", () => {
  it("skips when disabled", () => {
    const result = evaluateFlipyAutoCreate({
      enabled: false,
      minConfidence: "high",
      flipyEnvioId: null,
      payment: basePayment,
      destinationCoords: { lat: -12.1, lng: -77.0 },
      destinationAddress: "Miraflores",
    });
    assert.equal(result.eligible, false);
    assert.equal(result.skipReason, "disabled");
  });

  it("skips pickup orders", () => {
    const result = evaluateFlipyAutoCreate({
      enabled: true,
      minConfidence: "high",
      flipyEnvioId: null,
      payment: { ...basePayment, fulfillmentMode: "pickup", suggestedEscenario: null },
      destinationCoords: null,
      destinationAddress: "",
    });
    assert.equal(result.skipReason, "pickup");
  });

  it("requires high confidence by default", () => {
    const result = evaluateFlipyAutoCreate({
      enabled: true,
      minConfidence: "high",
      flipyEnvioId: null,
      payment: { ...basePayment, confidence: "medium" },
      destinationCoords: { lat: -12.1, lng: -77.0 },
      destinationAddress: "Miraflores",
    });
    assert.equal(result.skipReason, "low_confidence");
  });

  it("eligible with high confidence and coords", () => {
    const result = evaluateFlipyAutoCreate({
      enabled: true,
      minConfidence: "high",
      flipyEnvioId: null,
      payment: basePayment,
      destinationCoords: { lat: -12.1, lng: -77.0 },
      destinationAddress: "Miraflores, Lima",
    });
    assert.equal(result.eligible, true);
    assert.equal(result.escenarioPago, "1E");
  });

  it("builds shipping address from order fields", () => {
    const address = buildOrderShippingAddress({
      shipping_district: "Miraflores",
      shipping_city: "Lima",
      shipping_region: "LIM",
      shipping_country_code: "PE",
      shipping_postal_code: "15074",
    });
    assert.match(address, /Miraflores/);
    assert.match(address, /15074/);
  });

  it("reads destination coords when present", () => {
    const coords = readOrderDestinationCoords({
      shipping_latitude: -12.12,
      shipping_longitude: -77.03,
    });
    assert.ok(coords);
    assert.equal(coords?.lat, -12.12);
  });
});
