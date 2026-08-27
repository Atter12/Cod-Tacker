import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  initialFlipyFletePaymentStatus,
  labelFlipyFletePaymentStatus,
  mergeFlipyFletePaymentIntoMetadata,
  resolveFlipyFletePaymentStatus,
  shouldMarkFlipyFleteCollectedOnDelivered,
} from "@/lib/integrations/flipy/flete-payment-status";

const prepaidProductFleteDue = {
  productPaidAtCheckout: true,
  shippingPaidAtCheckout: false,
  smartEligible: false,
};

const bothPrepaid = {
  productPaidAtCheckout: true,
  shippingPaidAtCheckout: true,
  smartEligible: true,
};

describe("flipy flete payment status", () => {
  it("seeds expected when product prepaid and flete due at door", () => {
    assert.equal(
      initialFlipyFletePaymentStatus({ payment: prepaidProductFleteDue, escenario: "1E", fletePrice: 20 }),
      "expected",
    );
  });

  it("seeds prepaid for 1A / full prepaid", () => {
    assert.equal(
      initialFlipyFletePaymentStatus({ payment: bothPrepaid, escenario: "1A" }),
      "prepaid",
    );
  });

  it("resolves collected from ENTREGADO when expected", () => {
    const status = resolveFlipyFletePaymentStatus({
      metadata: {
        shopify_flipy_payment: { fletePaymentStatus: "expected", confirmedEscenario: "1E" },
      },
      flipyEnvioId: "env1",
      flipyEstado: "ENTREGADO",
      payment: prepaidProductFleteDue,
    });
    assert.equal(status, "collected");
    assert.equal(labelFlipyFletePaymentStatus(status!), "Flete cobrado");
  });

  it("hides badge without flipy envio", () => {
    assert.equal(
      resolveFlipyFletePaymentStatus({
        metadata: {},
        flipyEnvioId: null,
        payment: prepaidProductFleteDue,
      }),
      null,
    );
  });

  it("merge does not downgrade collected", () => {
    const next = mergeFlipyFletePaymentIntoMetadata(
      { shopify_flipy_payment: { fletePaymentStatus: "collected" } },
      { status: "expected", via: "create" },
    );
    const bag = next.shopify_flipy_payment as { fletePaymentStatus: string };
    assert.equal(bag.fletePaymentStatus, "collected");
  });

  it("should mark collected on delivered only from expected", () => {
    assert.equal(shouldMarkFlipyFleteCollectedOnDelivered("expected"), true);
    assert.equal(shouldMarkFlipyFleteCollectedOnDelivered("collected"), false);
    assert.equal(shouldMarkFlipyFleteCollectedOnDelivered("prepaid"), false);
  });
});
