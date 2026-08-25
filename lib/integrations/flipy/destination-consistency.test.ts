import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildPrefillShippingAddress,
  evaluateDestinationConsistency,
  haversineDistanceMeters,
  inferCountryFromAddressText,
  inferCountryFromCoords,
} from "@/lib/integrations/flipy/destination-consistency";

describe("destination-consistency", () => {
  it("detects Berlin text vs Lima pin", () => {
    const result = evaluateDestinationConsistency({
      address: "Berlin, DE, 10115",
      lat: -12.0464,
      lng: -77.0428,
      prefillAddress: "Berlin, DE, 10115",
    });
    assert.equal(result.ok, false);
    assert.equal(result.pinCountry, "PE");
    assert.equal(result.addressCountry, "DE");
    assert.ok(result.reasons.some((r) => r.startsWith("country_mismatch")));
  });

  it("flags prefill reuse after pin move > 200m", () => {
    const result = evaluateDestinationConsistency({
      address: "Miraflores, Lima, PE",
      lat: -12.12,
      lng: -77.03,
      prefillAddress: "Miraflores, Lima, PE",
      prefillCoords: { lat: -12.11, lng: -77.02 },
      pinMoveThresholdM: 200,
    });
    assert.equal(result.ok, false);
    assert.ok(result.movedFromPrefillM != null && result.movedFromPrefillM > 200);
  });

  it("accepts consistent PE address + pin", () => {
    const result = evaluateDestinationConsistency({
      address: "Av. Larco 123, Miraflores, Lima, PE",
      lat: -12.119,
      lng: -77.029,
    });
    assert.equal(result.ok, true);
  });

  it("builds prefill with address1 first", () => {
    const address = buildPrefillShippingAddress({
      address1: "Calle Falsa 123",
      district: "Miraflores",
      city: "Lima",
      countryCode: "PE",
      postalCode: "15074",
    });
    assert.match(address, /^Calle Falsa 123/);
    assert.match(address, /Miraflores/);
  });

  it("haversine and country helpers", () => {
    assert.ok(haversineDistanceMeters({ lat: 0, lng: 0 }, { lat: 0, lng: 0.01 }) > 1000);
    assert.equal(inferCountryFromCoords(-12.1, -77.0), "PE");
    assert.equal(inferCountryFromAddressText("Berlin, DE"), "DE");
  });
});
