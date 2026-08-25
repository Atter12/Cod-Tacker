import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  getFlipyFleteUiRule,
  initialFleteInputValue,
  isFlipyFleteLocked,
  validateFlipyFletePrice,
} from "@/lib/integrations/flipy/flete-rules";

const SAMPLE_QUOTE = {
  recommendedFare: 14.5,
  minOffer: 10.15,
  maxOffer: 43.5,
};

describe("flete-rules", () => {
  it("1A with smartEligible locks flete to quote (D4)", () => {
    const rule = getFlipyFleteUiRule("1A", { smartEligible: true });
    assert.equal(rule.locked, true);
    assert.equal(isFlipyFleteLocked({ smartEligible: true }), true);
    assert.match(rule.hint, /asignación automática/i);

    assert.equal(
      validateFlipyFletePrice("1A", "", { smartEligible: true, fleteQuote: SAMPLE_QUOTE }).ok,
      true,
    );
    assert.equal(
      validateFlipyFletePrice("1A", "", { smartEligible: true, fleteQuote: null }).ok,
      false,
    );
    assert.equal(
      validateFlipyFletePrice("1A", 14.5, { smartEligible: true, fleteQuote: SAMPLE_QUOTE }).ok,
      true,
    );
    assert.equal(
      validateFlipyFletePrice("1A", 16, { smartEligible: true, fleteQuote: SAMPLE_QUOTE }).ok,
      false,
    );
  });

  it("bid escenarios allow editable flete with market bounds", () => {
    for (const escenario of ["1C", "1E", "1D"] as const) {
      const rule = getFlipyFleteUiRule(escenario, { smartEligible: false });
      assert.equal(rule.locked, false);
      assert.match(rule.hint, /pujan/i);
      assert.equal(validateFlipyFletePrice(escenario, null, { smartEligible: false }).ok, false);
      assert.equal(
        validateFlipyFletePrice(escenario, 15, {
          smartEligible: false,
          fleteQuote: SAMPLE_QUOTE,
        }).ok,
        true,
      );
      assert.equal(
        validateFlipyFletePrice(escenario, 5, {
          smartEligible: false,
          fleteQuote: SAMPLE_QUOTE,
        }).ok,
        false,
      );
    }
  });

  it("prefills suggested flete when > 0", () => {
    assert.equal(initialFleteInputValue("1E", 18, { smartEligible: false }), "18");
    assert.equal(initialFleteInputValue("1A", 0, { smartEligible: false }), "");
    assert.equal(
      initialFleteInputValue("1A", null, {
        smartEligible: true,
        fleteQuote: SAMPLE_QUOTE,
      }),
      "14.5",
    );
  });
});
