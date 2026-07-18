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
    total_amount: 100,
    payment_status: "cash_expected",
    cash_collected_at: null,
    ...partial,
  };
}

describe("dashboard revenue (S13)", () => {
  it("separates checkout / delivered / collected without delivery-rate proxy", () => {
    const orders = [
      order({
        id: "a",
        expected_cod_amount: 100,
        collected_cod_amount: 100,
        payment_status: "cash_collected",
        cash_collected_at: "2026-07-01T12:00:00.000Z",
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
        payment_status: "cash_collected",
        cash_collected_at: "2026-07-02T12:00:00.000Z",
      }),
    ];
    // 4 generated, 2 delivered (a,d), 1 RTO (c) — legacy proxy would lie
    const shipments = [
      { order_id: "a", status: "delivered", is_rto: false },
      { order_id: "d", status: "delivered", is_rto: false },
      { order_id: "c", status: "returned", is_rto: true },
    ];

    const checkoutRevenue = 400; // attributed at checkout for all 4
    const spend = 100;
    const cashExpected = 400;

    const beforeProxy = legacyDeliveredRevenueProxy({
      cashExpected,
      deliveredCount: 2,
      generatedCount: 4,
    });
    // BEFORE: expected COD × delivered/generated = 400 × 0.5 = 200
    assert.equal(beforeProxy, 200);

    const after = computeDashboardRevenueTotals({
      orders,
      shipments,
      checkoutRevenue,
      spend,
    });

    // AFTER: delivered = sum expected COD of delivered orders only (a+d = 200)
    assert.equal(after.deliveredRevenue, 200);
    // Collected = door cash only (100 + 80), not expected COD and not proxy
    assert.equal(after.collectedRevenue, 180);
    assert.equal(after.checkoutRevenue, 400);

    assert.equal(after.roasCheckout, 4);
    assert.equal(after.roasDelivered, 2);
    assert.equal(after.roasCollected, 1.8);

    assert.notEqual(after.checkoutRevenue, after.deliveredRevenue);
    assert.notEqual(after.deliveredRevenue, after.collectedRevenue);
    assert.notEqual(after.roasCheckout, after.roasCollected);
  });

  it("returns null ROAS when ad spend is missing (no fake 0.00)", () => {
    const totals = computeDashboardRevenueTotals({
      orders: [
        order({
          id: "a",
          collected_cod_amount: 372.35,
          payment_status: "cash_collected",
          cash_collected_at: "2026-07-17T12:00:00.000Z",
        }),
      ],
      shipments: [{ order_id: "a", status: "delivered", is_rto: false }],
      checkoutRevenue: 400,
      spend: 0,
    });
    assert.equal(totals.collectedRevenue, 372.35);
    assert.equal(totals.roasCheckout, null);
    assert.equal(totals.roasDelivered, null);
    assert.equal(totals.roasCollected, null);
  });

  it("shows before/after gap when proxy inflated delivered revenue", () => {
    // High expected COD on undelivered orders → proxy pulls them into "delivered revenue"
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

    // BEFORE lied: 1000 × 0.5 = 500 (includes half of the undelivered 950)
    assert.equal(before, 500);
    // AFTER honest: only the delivered order's 50
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
  });

  it("falls back to total_amount when expected COD is null", () => {
    assert.equal(orderDeliveredValue({ expected_cod_amount: null, total_amount: 77 }), 77);
    assert.equal(orderDeliveredValue({ expected_cod_amount: 40, total_amount: 77 }), 40);
  });
});
