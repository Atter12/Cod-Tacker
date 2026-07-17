import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  isNewlyDeliveredTerminal,
  shouldFirePurchaseOnDelivered,
  shouldMarkCashCollectedOnDelivered,
} from "@/lib/conversions/delivered-purchase-policy";

describe("delivered purchase policy (S11)", () => {
  it("fires CAPI for COD payment statuses only", () => {
    assert.equal(shouldFirePurchaseOnDelivered("cash_expected"), true);
    assert.equal(shouldFirePurchaseOnDelivered("partially_collected"), true);
    assert.equal(shouldFirePurchaseOnDelivered("cash_collected"), true);
    assert.equal(shouldFirePurchaseOnDelivered("unpaid"), false);
    assert.equal(shouldFirePurchaseOnDelivered("settled"), false);
    assert.equal(shouldFirePurchaseOnDelivered("refunded"), false);
  });

  it("marks cash only when still expecting collection", () => {
    assert.equal(shouldMarkCashCollectedOnDelivered("cash_expected"), true);
    assert.equal(shouldMarkCashCollectedOnDelivered("partially_collected"), true);
    assert.equal(shouldMarkCashCollectedOnDelivered("cash_collected"), false);
    assert.equal(shouldMarkCashCollectedOnDelivered("unpaid"), false);
  });

  it("detects newly delivered terminal and ignores RTO / skips", () => {
    assert.equal(
      isNewlyDeliveredTerminal({
        skippedDuplicate: false,
        skipStatusUpdate: false,
        normalizedStatus: "delivered",
      }),
      true,
    );
    assert.equal(
      isNewlyDeliveredTerminal({
        skippedDuplicate: false,
        skipStatusUpdate: false,
        normalizedStatus: "returned",
      }),
      false,
    );
    assert.equal(
      isNewlyDeliveredTerminal({
        skippedDuplicate: true,
        skipStatusUpdate: false,
        normalizedStatus: "delivered",
      }),
      false,
    );
    assert.equal(
      isNewlyDeliveredTerminal({
        skippedDuplicate: false,
        skipStatusUpdate: true,
        normalizedStatus: "delivered",
      }),
      false,
    );
  });
});
