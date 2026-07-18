import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  evaluatePurchaseRelease,
  labelHoldReason,
  labelReleaseStatus,
} from "@/lib/conversions/release-policy";

describe("conversion release filter", () => {
  it("releases when cash is collected", () => {
    const decision = evaluatePurchaseRelease({
      value: 100,
      orderStatus: "delivered",
      paymentStatus: "cash_collected",
      confirmationStatus: "confirmed",
    });
    assert.equal(decision.release, true);
    assert.equal(decision.reason, "payment_collected");
  });

  it("releases partially collected and settled payments", () => {
    for (const paymentStatus of ["partially_collected", "settlement_pending", "settled"] as const) {
      const decision = evaluatePurchaseRelease({
        value: 50,
        orderStatus: "delivered",
        paymentStatus,
        confirmationStatus: "confirmed",
      });
      assert.equal(decision.release, true, paymentStatus);
    }
  });

  it("releases delivered COD even before the cash mark lands", () => {
    const decision = evaluatePurchaseRelease({
      value: 80,
      orderStatus: "delivered",
      paymentStatus: "cash_expected",
      confirmationStatus: "confirmed",
    });
    assert.equal(decision.release, true);
    assert.equal(decision.reason, "delivered_cod");
  });

  it("holds prepaid orders that were not collected", () => {
    const decision = evaluatePurchaseRelease({
      value: 80,
      orderStatus: "delivered",
      paymentStatus: "unpaid",
      confirmationStatus: "confirmed",
    });
    assert.equal(decision.release, false);
    assert.equal(decision.reason, "awaiting_collection");
  });

  it("holds COD not yet delivered nor collected", () => {
    const decision = evaluatePurchaseRelease({
      value: 80,
      orderStatus: "in_transit",
      paymentStatus: "cash_expected",
      confirmationStatus: "confirmed",
    });
    assert.equal(decision.release, false);
    assert.equal(decision.reason, "awaiting_collection");
  });

  it("holds non-positive values", () => {
    for (const value of [0, -10, Number.NaN]) {
      const decision = evaluatePurchaseRelease({
        value,
        orderStatus: "delivered",
        paymentStatus: "cash_collected",
        confirmationStatus: "confirmed",
      });
      assert.equal(decision.release, false, String(value));
      assert.equal(decision.reason, "non_positive_value");
    }
  });

  it("holds cancelled / rejected / returned orders even when collected", () => {
    for (const orderStatus of [
      "cancelled",
      "rejected",
      "return_in_transit",
      "returned",
      "lost",
    ] as const) {
      const decision = evaluatePurchaseRelease({
        value: 100,
        orderStatus,
        paymentStatus: "cash_collected",
        confirmationStatus: "confirmed",
      });
      assert.equal(decision.release, false, orderStatus);
      assert.equal(decision.reason, "order_terminal_negative");
    }
  });

  it("holds rejected confirmations", () => {
    const decision = evaluatePurchaseRelease({
      value: 100,
      orderStatus: "delivered",
      paymentStatus: "cash_collected",
      confirmationStatus: "rejected",
    });
    assert.equal(decision.release, false);
    assert.equal(decision.reason, "confirmation_rejected");
  });

  it("holds refunded / written off payments", () => {
    for (const paymentStatus of ["refunded", "written_off"] as const) {
      const decision = evaluatePurchaseRelease({
        value: 100,
        orderStatus: "delivered",
        paymentStatus,
        confirmationStatus: "confirmed",
      });
      assert.equal(decision.release, false, paymentStatus);
      assert.equal(decision.reason, "payment_refunded_or_written_off");
    }
  });

  it("tolerates missing order context by holding", () => {
    const decision = evaluatePurchaseRelease({
      value: 100,
      orderStatus: null,
      paymentStatus: null,
      confirmationStatus: null,
    });
    assert.equal(decision.release, false);
    assert.equal(decision.reason, "awaiting_collection");
  });

  it("labels statuses and hold reasons in Spanish", () => {
    assert.equal(labelReleaseStatus("pending_review"), "En revisión");
    assert.equal(labelReleaseStatus("released"), "Liberada");
    assert.equal(labelReleaseStatus("rejected"), "Rechazada");
    assert.equal(labelHoldReason("awaiting_collection"), "A la espera de cobro/entrega confirmada");
    assert.equal(labelHoldReason("manual_reject"), "Rechazada manualmente");
    assert.equal(labelHoldReason(null), null);
  });
});
