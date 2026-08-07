import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  isNewlyDeliveredTerminal,
  shouldFirePurchaseOnDelivered,
  shouldMarkCashCollectedOnDelivered,
} from "@/lib/conversions/delivered-purchase-policy";

describe("delivered purchase policy (cash truth)", () => {
  it("never fires Purchase on delivered alone", () => {
    for (const status of [
      "cash_expected",
      "partially_collected",
      "cash_collected",
      "unpaid",
      "settled",
      "refunded",
    ] as const) {
      assert.equal(shouldFirePurchaseOnDelivered(status), false, status);
    }
  });

  it("never auto-marks cash_collected on delivered", () => {
    for (const status of [
      "cash_expected",
      "partially_collected",
      "cash_collected",
      "unpaid",
    ] as const) {
      assert.equal(shouldMarkCashCollectedOnDelivered(status), false, status);
    }
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
