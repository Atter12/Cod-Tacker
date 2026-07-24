import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  computeDashboardRevenueTotals,
  legacyDeliveredRevenueProxy,
  orderDeliveredValue,
  type DashboardRevenueOrder,
} from "@/lib/dashboard/revenue";

function order(
  partial: Partial<DashboardRevenueOrder> & Pick<DashboardRevenueOrder, "id">,
): DashboardRevenueOrder {
  return {
    expected_cod_amount: 100,
    collected_cod_amount: null,
    settled_cod_amount: null,
    total_amount: 100,
    payment_status: "cash_expected",
    cash_collected_at: null,
    settled_at: null,
    ...partial,
  };
}

describe("dashboard revenue (S13)", () => {
  it("separates checkout / delivered / collected / settled without delivery-rate proxy", () => {
    const orders = [
      order({
        id: "a",
        expected_cod_amount: 100,
        collected_cod_amount: 100,
        settled_cod_amount: 92,
        payment_status: "settled",
        cash_collected_at: "2026-07-01T12:00:00.000Z",
        settled_at: "2026-07-03T12:00:00.000Z",
      }),
      order({
        id: "b",
        expected_cod_amount: 100,
        collected_cod_amount: null,
        payment_status: "cash_expected",
      }),
      order({
        id: "c",
        expected_cod_amount: 100,
        collected_cod_amount: null,
        payment_status: "cash_expected",
      }),
      order({
        id: "d",
        expected_cod_amount: 100,
        collected_cod_amount: 80,
        settled_cod_amount: null,
        payment_status: "cash_collected",
        cash_collected_at: "2026-07-02T12:00:00.000Z",
      }),
    ];
    const shipments = [
      { order_id: "a", status: "delivered", is_rto: false },
      { order_id: "d", status: "delivered", is_rto: false },
      { order_id: "c", status: "returned", is_rto: true },
    ];

    const checkoutRevenue = 400;
    const spend = 100;
    const cashExpected = 400;

    const beforeProxy = legacyDeliveredRevenueProxy({
      cashExpected,
      deliveredCount: 2,
      generatedCount: 4,
    });
    assert.equal(beforeProxy, 200);

    const after = computeDashboardRevenueTotals({
      orders,
      shipments,
      checkoutRevenue,
      spend,
    });

    assert.equal(after.deliveredRevenue, 200);
    // Provisional door cash (a+d)
    assert.equal(after.collectedRevenue, 180);
    // Reconciled cash only (a settled 92; d not liquidated)
    assert.equal(after.settledRevenue, 92);
    assert.equal(after.checkoutRevenue, 400);

    assert.equal(after.roasCheckout, 4);
    assert.equal(after.roasDelivered, 2);
    assert.equal(after.roasCollected, 1.8);
    assert.equal(after.roasSettled, 0.92);

    assert.notEqual(after.collectedRevenue, after.settledRevenue);
    assert.notEqual(after.roasCollected, after.roasSettled);
  });

  it("returns null ROAS when ad spend is missing (no fake 0.00)", () => {
    const totals = computeDashboardRevenueTotals({
      orders: [
        order({
          id: "a",
          collected_cod_amount: 372.35,
          settled_cod_amount: 350,
          payment_status: "settled",
          cash_collected_at: "2026-07-17T12:00:00.000Z",
          settled_at: "2026-07-18T12:00:00.000Z",
        }),
      ],
      shipments: [{ order_id: "a", status: "delivered", is_rto: false }],
      checkoutRevenue: 400,
      spend: 0,
    });
    assert.equal(totals.collectedRevenue, 372.35);
    assert.equal(totals.settledRevenue, 350);
    assert.equal(totals.roasCheckout, null);
    assert.equal(totals.roasDelivered, null);
    assert.equal(totals.roasCollected, null);
    assert.equal(totals.roasSettled, null);
  });

  it("shows before/after gap when proxy inflated delivered revenue", () => {
    const orders = [
      order({ id: "delivered", expected_cod_amount: 50, total_amount: 50 }),
      order({ id: "pending-big", expected_cod_amount: 950, total_amount: 950 }),
    ];
    const shipments = [{ order_id: "delivered", status: "delivered", is_rto: false }];

    const cashExpected = 1000;
    const before = legacyDeliveredRevenueProxy({
      cashExpected,
      deliveredCount: 1,
      generatedCount: 2,
    });
    const after = computeDashboardRevenueTotals({
      orders,
      shipments,
      checkoutRevenue: 1000,
      spend: 100,
    });

    assert.equal(before, 500);
    assert.equal(after.deliveredRevenue, 50);
    assert.ok(before > after.deliveredRevenue);
  });

  it("does not count RTO shipments toward delivered revenue", () => {
    const orders = [order({ id: "rto", expected_cod_amount: 200 })];
    const totals = computeDashboardRevenueTotals({
      orders,
      shipments: [{ order_id: "rto", status: "returned", is_rto: true }],
      checkoutRevenue: 200,
      spend: 50,
    });
    assert.equal(totals.deliveredRevenue, 0);
    assert.equal(totals.collectedRevenue, 0);
    assert.equal(totals.settledRevenue, 0);
  });

  it("falls back to total_amount when expected COD is null", () => {
    assert.equal(orderDeliveredValue({ expected_cod_amount: null, total_amount: 77 }), 77);
    assert.equal(orderDeliveredValue({ expected_cod_amount: 40, total_amount: 77 }), 40);
  });
});
