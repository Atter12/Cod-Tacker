import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  applyGeocodedShopifyDelivery,
  isLikelyShopifySampleAddress,
  isOutsideFlipyDeliveryCountry,
  resolveShopifyDeliveryPoint,
} from "@/lib/integrations/flipy/shopify-delivery";

describe("shopify-delivery", () => {
  it("flags US sample addresses like Sitka, Alaska", () => {
    assert.equal(
      isLikelyShopifySampleAddress({
        city: "Sitka",
        region: "Alaska",
        countryCode: "US",
      }),
      true,
    );
    assert.equal(isOutsideFlipyDeliveryCountry("US"), true);
  });

  it("requires map for non-PE Shopify shipping", () => {
    const result = resolveShopifyDeliveryPoint({
      prefillAddress: "Sitka, Alaska, US, 99835",
      shippingCountryCode: "US",
      shippingCity: "Sitka",
      shippingRegion: "Alaska",
      customerName: "Test",
      customerPhone: "999888777",
    });
    assert.equal(result.requiresMap, true);
    assert.equal(result.autoConfirmed, false);
    assert.equal(result.needsGeocode, false);
    assert.ok(result.hint?.includes("Perú"));
  });

  it("auto-confirms PE address when coords are consistent", () => {
    const result = resolveShopifyDeliveryPoint({
      prefillAddress: "Av. Larco 123, Miraflores, Lima, PE",
      prefillCoords: { lat: -12.119, lng: -77.029 },
      shippingCountryCode: "PE",
      shippingAddress1: "Av. Larco 123",
      customerName: "Cliente",
      customerPhone: "987654321",
    });
    assert.equal(result.autoConfirmed, true);
    assert.equal(result.point.pinConfirmed, true);
    assert.equal(result.needsGeocode, false);
  });

  it("requests geocode for PE address without coords", () => {
    const result = resolveShopifyDeliveryPoint({
      prefillAddress: "Avenida Cusco 286, Urb Cercado de Lima, PE",
      shippingCountryCode: "PE",
      shippingAddress1: "Avenida Cusco 286",
      customerName: "Cliente",
      customerPhone: "987654321",
    });
    assert.equal(result.needsGeocode, true);
    assert.equal(result.requiresMap, false);
    assert.equal(result.point.pinConfirmed, false);
  });

  it("accepts geocoded PE delivery", () => {
    const applied = applyGeocodedShopifyDelivery({
      point: {
        address: "Avenida Cusco 286, Lima, PE",
        lat: NaN,
        lng: NaN,
        contactName: "Cliente",
        contactPhone: "987654321",
        pinConfirmed: false,
      },
      geocoded: {
        address: "Avenida Cusco 286, Cercado de Lima, Lima, PE",
        lat: -12.0464,
        lng: -77.0428,
      },
      prefillAddress: "Avenida Cusco 286, Urb Cercado de Lima, PE",
    });
    assert.ok(applied);
    assert.equal(applied?.point.pinConfirmed, true);
    assert.equal(applied?.autoConfirmed, true);
  });
});
