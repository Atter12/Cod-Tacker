import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildFlipyRouteKey,
  canRecalcFleteLocally,
  isUsableFlipyFleteDistance,
  recalcFleteFromDistance,
} from "@/lib/integrations/flipy/flete-quote-local";

describe("flete-quote-local", () => {
  it("buildFlipyRouteKey rounds coords to 5 decimals", () => {
    const key = buildFlipyRouteKey({
      originLat: -12.119000001,
      originLng: -77.029000004,
      destinationLat: -12.096000006,
      destinationLng: -77.028000003,
    });
    assert.equal(key, "-12.11900,-77.02900|-12.09600,-77.02800");
  });

  it("recalcFleteFromDistance matches formula tiers", () => {
    const quote = recalcFleteFromDistance(10, "mediano", "express", "directions", {
      durationMinutes: 25,
    });
    assert.equal(quote.version, 2);
    assert.equal(quote.distanceKm, 10);
    assert.equal(quote.durationMinutes, 25);
    assert.equal(quote.packageSize, "mediano");
    assert.equal(quote.source, "directions");
    assert.ok(quote.recommendedFare >= 5);
    assert.ok(quote.marketLow! < quote.recommendedFare);
    assert.ok(quote.marketHigh! > quote.recommendedFare);
  });

  it("pequeno vs grande changes recommended fare", () => {
    const pequeno = recalcFleteFromDistance(5, "pequeno");
    const grande = recalcFleteFromDistance(5, "grande");
    assert.ok(grande.recommendedFare > pequeno.recommendedFare);
  });

  it("canRecalcFleteLocally requires usable distanceKm", () => {
    assert.equal(canRecalcFleteLocally(null), false);
    assert.equal(canRecalcFleteLocally({ recommendedFare: 10 }), false);
    assert.equal(canRecalcFleteLocally({ recommendedFare: 10, distanceKm: 0 }), false);
    assert.equal(canRecalcFleteLocally({ recommendedFare: 10, distanceKm: 0.05 }), false);
    assert.equal(canRecalcFleteLocally({ recommendedFare: 10, distanceKm: 3.2 }), true);
  });

  it("isUsableFlipyFleteDistance rejects ~0 km quotes", () => {
    assert.equal(isUsableFlipyFleteDistance(0), false);
    assert.equal(isUsableFlipyFleteDistance(0.0), false);
    assert.equal(isUsableFlipyFleteDistance(7.6), true);
  });

  it("0 km + grande yields the stale 9.50 fare (why we gate distance)", () => {
    const quote = recalcFleteFromDistance(0, "grande", "express");
    assert.equal(quote.recommendedFare, 9.5);
    assert.equal(isUsableFlipyFleteDistance(quote.distanceKm), false);
  });
});
