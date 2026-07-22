import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { mapEcartTransactionsToSettlementRows } from "@/lib/integrations/ecart-pay/map-transactions";

describe("mapEcartTransactionsToSettlementRows", () => {
  it("maps paid transactions and skips unpaid / zero", () => {
    const rows = mapEcartTransactionsToSettlementRows([
      {
        id: "tx1",
        status: "paid",
        amount: 100,
        fee: 8,
        currency: "PEN",
        reference: "ORD-100",
        tracking_number: "TRK-1",
        created_at: "2026-07-01T00:00:00.000Z",
      },
      { id: "tx2", status: "pending", amount: 50, currency: "PEN" },
      { id: "tx3", status: "paid", amount: 0, currency: "PEN" },
    ]);
    assert.equal(rows.length, 1);
    assert.equal(rows[0]!.orderNumber, "ORD-100");
    assert.equal(rows[0]!.trackingNumber, "TRK-1");
    assert.equal(rows[0]!.grossAmount, 100);
    assert.equal(rows[0]!.feeAmount, 8);
    assert.equal(rows[0]!.netAmount, 92);
  });
});
