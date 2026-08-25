import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  getFlipyFleteUiRule,
  initialFleteInputValue,
  validateFlipyFletePrice,
} from "@/lib/integrations/flipy/flete-rules";

describe("flete-rules", () => {
  it("1A requires oferta > 0 and never says optional", () => {
    const rule = getFlipyFleteUiRule("1A");
    assert.equal(rule.required, true);
    assert.equal(rule.optional, false);
    assert.match(rule.label, /Oferta de flete/);
    assert.equal(validateFlipyFletePrice("1A", "").ok, false);
    assert.equal(validateFlipyFletePrice("1A", 0).ok, false);
    assert.equal(validateFlipyFletePrice("1A", 15).ok, true);
    assert.equal(validateFlipyFletePrice("1A", 15).value, 15);
  });

  it("COD escenarios also require flete", () => {
    for (const escenario of ["1C", "1E", "1D"] as const) {
      const rule = getFlipyFleteUiRule(escenario);
      assert.equal(rule.optional, false);
      assert.equal(validateFlipyFletePrice(escenario, null).ok, false);
    }
  });

  it("prefills suggested flete when > 0", () => {
    assert.equal(initialFleteInputValue("1A", 18), "18");
    assert.equal(initialFleteInputValue("1A", 0), "");
    assert.equal(initialFleteInputValue("1A", null), "");
  });
});
