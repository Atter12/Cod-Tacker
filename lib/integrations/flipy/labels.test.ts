import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  deriveCodAmountFromD3,
  flipyEscenarioOptionsForUi,
  shouldSkipFlipyCodPaymentStep,
  shouldSuggestFlipyEscenario1DForYape,
} from "@/lib/integrations/flipy/labels";
import type { FlipyPaymentResolution } from "@/lib/integrations/flipy/resolve-payment";

function basePayment(
  overrides: Partial<FlipyPaymentResolution> = {},
): FlipyPaymentResolution {
  return {
    fulfillmentMode: "delivery",
    productPaidAtCheckout: false,
    shippingPaidAtCheckout: false,
    smartEligible: false,
    flipyFulfillmentMode: "bid",
    expectedCodProduct: 89,
    expectedCodShipping: 15,
    suggestedEscenario: "1E",
    codAmount: 89,
    suggestedFlete: null,
    confidence: "high",
    requiresUserConfirmation: false,
    reasons: [],
    ...overrides,
  };
}

describe("flipy labels — D3 vs escenario channel", () => {
  it("skips COD step only when P and F prepaid", () => {
    assert.equal(
      shouldSkipFlipyCodPaymentStep(
        basePayment({ productPaidAtCheckout: true, shippingPaidAtCheckout: true }),
      ),
      true,
    );
    assert.equal(
      shouldSkipFlipyCodPaymentStep(
        basePayment({ productPaidAtCheckout: true, shippingPaidAtCheckout: false }),
      ),
      false,
    );
    assert.equal(
      shouldSkipFlipyCodPaymentStep(
        basePayment({ productPaidAtCheckout: false, shippingPaidAtCheckout: true }),
      ),
      false,
    );
  });

  it("shows all COD channels when destino cobro exists", () => {
    const opts = flipyEscenarioOptionsForUi(
      basePayment({ productPaidAtCheckout: true, shippingPaidAtCheckout: false }),
    );
    assert.deepEqual(opts.map((o) => o.value), ["1C", "1E", "1D"]);
  });

  it("codAmount from D3 applies to 1D when product is COD", () => {
    const payment = basePayment();
    assert.equal(deriveCodAmountFromD3("1D", payment), 89);
    assert.equal(deriveCodAmountFromD3("1E", payment), 89);
    assert.equal(deriveCodAmountFromD3("1A", payment), null);
  });

  it("codAmount zero when product prepaid regardless of escenario channel", () => {
    const payment = basePayment({
      productPaidAtCheckout: true,
      expectedCodProduct: 0,
      codAmount: null,
    });
    assert.equal(deriveCodAmountFromD3("1D", payment), null);
    assert.equal(deriveCodAmountFromD3("1E", payment), null);
  });

  it("warns on 1C above Yape tope", () => {
    assert.equal(shouldSuggestFlipyEscenario1DForYape("1C", 350), true);
    assert.equal(shouldSuggestFlipyEscenario1DForYape("1E", 350), false);
    assert.equal(shouldSuggestFlipyEscenario1DForYape("1C", 200), false);
  });
});
