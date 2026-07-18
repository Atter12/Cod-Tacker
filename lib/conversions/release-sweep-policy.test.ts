import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  decideSweepAction,
  HELD_RECHECK_INTERVAL_MS,
  nextHeldRecheckAt,
} from "@/lib/conversions/release-sweep-policy";

describe("conversion release sweep policy", () => {
  it("releases a held candidate once cash is collected", () => {
    const { action, decision } = decideSweepAction({
      value: 100,
      orderStatus: "delivered",
      paymentStatus: "cash_collected",
      confirmationStatus: "confirmed",
    });
    assert.equal(action, "release");
    assert.equal(decision.reason, "payment_collected");
  });

  it("releases delivered COD awaiting the cash mark", () => {
    const { action, decision } = decideSweepAction({
      value: 80,
      orderStatus: "delivered",
      paymentStatus: "cash_expected",
      confirmationStatus: "confirmed",
    });
    assert.equal(action, "release");
    assert.equal(decision.reason, "delivered_cod");
  });

  it("auto-rejects terminal negative orders", () => {
    for (const orderStatus of [
      "cancelled",
      "rejected",
      "return_in_transit",
      "returned",
      "lost",
    ] as const) {
      const { action, decision } = decideSweepAction({
        value: 100,
        orderStatus,
        paymentStatus: "cash_collected",
        confirmationStatus: "confirmed",
      });
      assert.equal(action, "reject", orderStatus);
      assert.equal(decision.reason, "order_terminal_negative");
    }
  });

  it("auto-rejects rejected confirmations and refunded payments", () => {
    assert.equal(
      decideSweepAction({
        value: 100,
        orderStatus: "delivered",
        paymentStatus: "cash_collected",
        confirmationStatus: "rejected",
      }).action,
      "reject",
    );
    for (const paymentStatus of ["refunded", "written_off"] as const) {
      assert.equal(
        decideSweepAction({
          value: 100,
          orderStatus: "delivered",
          paymentStatus,
          confirmationStatus: "confirmed",
        }).action,
        "reject",
        paymentStatus,
      );
    }
  });

  it("keeps holding candidates that can still recover", () => {
    // Awaiting collection: a later payment can flip it.
    const awaiting = decideSweepAction({
      value: 80,
      orderStatus: "in_transit",
      paymentStatus: "cash_expected",
      confirmationStatus: "confirmed",
    });
    assert.equal(awaiting.action, "hold");
    assert.equal(awaiting.decision.reason, "awaiting_collection");

    // Non-positive value: an order edit can fix it.
    const zeroValue = decideSweepAction({
      value: 0,
      orderStatus: "delivered",
      paymentStatus: "cash_collected",
      confirmationStatus: "confirmed",
    });
    assert.equal(zeroValue.action, "hold");
    assert.equal(zeroValue.decision.reason, "non_positive_value");
  });

  it("holds when order context is missing", () => {
    const { action } = decideSweepAction({
      value: 100,
      orderStatus: null,
      paymentStatus: null,
      confirmationStatus: null,
    });
    assert.equal(action, "hold");
  });

  it("schedules the next held recheck at the policy interval", () => {
    const now = new Date("2026-07-18T12:00:00.000Z");
    const next = nextHeldRecheckAt(now);
    assert.equal(next.getTime() - now.getTime(), HELD_RECHECK_INTERVAL_MS);
  });
});
