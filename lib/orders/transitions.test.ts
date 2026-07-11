import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  canTransitionOrderStatus,
  canTransitionPaymentStatus,
  assertOrderStatusTransition,
  assertPaymentStatusTransition,
} from "./transitions";
import { ValidationError } from "@/lib/errors";

describe("order transitions", () => {
  it("allows created → confirmed", () => {
    assert.equal(canTransitionOrderStatus("created", "confirmed"), true);
  });

  it("blocks delivered → created", () => {
    assert.equal(canTransitionOrderStatus("delivered", "created"), false);
    assert.throws(() => assertOrderStatusTransition("delivered", "created"), ValidationError);
  });

  it("blocks settled without settlement_pending unless admin override", () => {
    assert.equal(canTransitionPaymentStatus("cash_collected", "settled"), false);
    assert.equal(canTransitionPaymentStatus("settlement_pending", "settled"), true);
    assert.equal(canTransitionPaymentStatus("cash_collected", "settled", { adminOverride: true }), true);
    assert.throws(
      () => assertPaymentStatusTransition("unpaid", "settled"),
      ValidationError,
    );
  });
});
