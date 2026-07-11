import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { computeAdsKpis, formatRoas, formatRate } from "@/lib/attribution/metrics";

describe("attribution metrics", () => {
  it("returns null ROAS when spend is zero (no fake infinity)", () => {
    const kpis = computeAdsKpis({
      spend: 0,
      ordersGenerated: 10,
      ordersConfirmed: 8,
      ordersShipped: 7,
      ordersDelivered: 5,
      ordersRejected: 1,
      ordersReturned: 1,
      revenueGenerated: 1000,
      deliveredValue: 500,
      collectedValue: 400,
      settledValue: 350,
    });
    assert.equal(kpis.roasGenerated, null);
    assert.equal(kpis.roasDelivered, null);
    assert.equal(formatRoas(null), "—");
  });

  it("ROAS delivered excludes returned value when caller passes delivered-only totals", () => {
    const kpis = computeAdsKpis({
      spend: 100,
      ordersGenerated: 10,
      ordersConfirmed: 10,
      ordersShipped: 10,
      ordersDelivered: 7,
      ordersRejected: 0,
      ordersReturned: 3,
      revenueGenerated: 1000,
      deliveredValue: 700, // returned 300 excluded by caller
      collectedValue: 600,
      settledValue: 550,
    });
    assert.equal(kpis.roasDelivered, 7);
    assert.equal(kpis.roasSettled, 5.5);
    assert.equal(kpis.roasCollected, 6);
    assert.ok((kpis.rtoRate ?? 0) > 0);
  });

  it("settled ROAS uses settled value only", () => {
    const kpis = computeAdsKpis({
      spend: 50,
      ordersGenerated: 5,
      ordersConfirmed: 5,
      ordersShipped: 5,
      ordersDelivered: 5,
      ordersRejected: 0,
      ordersReturned: 0,
      revenueGenerated: 500,
      deliveredValue: 500,
      collectedValue: 480,
      settledValue: 450,
    });
    assert.equal(kpis.roasSettled, 9);
    assert.notEqual(kpis.roasSettled, kpis.roasGenerated);
  });

  it("rates are null when denominators are zero", () => {
    const kpis = computeAdsKpis({
      spend: 10,
      ordersGenerated: 0,
      ordersConfirmed: 0,
      ordersShipped: 0,
      ordersDelivered: 0,
      ordersRejected: 0,
      ordersReturned: 0,
      revenueGenerated: 0,
      deliveredValue: 0,
      collectedValue: 0,
      settledValue: 0,
    });
    assert.equal(kpis.confirmationRate, null);
    assert.equal(kpis.deliveryRate, null);
    assert.equal(formatRate(null), "—");
  });
});
