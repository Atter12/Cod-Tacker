import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  emptyFlipyRoutePoint,
  getFlipyRouteCardStatus,
  hasFlipyRouteLocation,
  isValidPeMobile,
  validateFlipyRoutePoint,
} from "@/lib/integrations/flipy/route-address";

describe("flipy route address", () => {
  it("detects empty vs partial vs saved card status", () => {
    assert.equal(getFlipyRouteCardStatus(emptyFlipyRoutePoint()), "empty");
    assert.equal(
      getFlipyRouteCardStatus({
        ...emptyFlipyRoutePoint(),
        address: "Av. Larco 1, Miraflores",
        lat: -12.12,
        lng: -77.03,
        pinConfirmed: true,
      }),
      "partial",
    );
    assert.equal(
      getFlipyRouteCardStatus({
        address: "Av. Larco 1",
        lat: -12.12,
        lng: -77.03,
        pinConfirmed: true,
        contactName: "Juan",
        contactPhone: "912345678",
      }),
      "saved",
    );
  });

  it("validates pickup and delivery points", () => {
    assert.ok(validateFlipyRoutePoint(emptyFlipyRoutePoint(), "pickup"));
    const ok = {
      address: "Av. Larco 1",
      lat: -12.12,
      lng: -77.03,
      pinConfirmed: true,
      contactName: "Juan",
      contactPhone: "912345678",
    };
    assert.equal(validateFlipyRoutePoint(ok, "pickup"), null);
    assert.equal(hasFlipyRouteLocation(ok), true);
  });

  it("validates PE mobile", () => {
    assert.equal(isValidPeMobile("912345678"), true);
    assert.equal(isValidPeMobile("812345678"), false);
  });
});
