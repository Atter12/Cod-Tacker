import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { mapShopifyActiveSubscription } from "@/lib/billing/shopify-subscription-map";
import { decideShopifySubscriptionSync } from "@/lib/billing/shopify-subscription-guard";
import { resolveConsoleBillingChrome } from "@/lib/billing/console-billing-mode";
import { gateConfirmCollectedRemesa } from "@/lib/reconciliation/collected-gate";
import { matchSettlementRow } from "@/lib/reconciliation/matching";
import { decideSettlementCollectedAction } from "@/lib/reconciliation/settlement-apply-gate";

const order = {
  id: "order-1",
  orderNumber: "1001",
  externalOrderId: "1001",
  expectedCodAmount: 104,
  collectedCodAmount: null,
  currencyCode: "PEN",
  createdAt: "2026-10-01T00:00:00.000Z",
  deliveredAt: "2026-10-08T00:00:00.000Z",
};

/**
 * Strategic group 5 — Dinero.
 * A collected COD row is applied once. An unmatched remesa does not settle the order.
 * Shopify App Pricing fills the plan and leaves an active Stripe subscription alone.
 */
describe("strategic · dinero", () => {
  it("does not mark cash collected a second time", () => {
    const first = gateConfirmCollectedRemesa({
      remesaAmount: 104,
      itemCurrency: "PEN",
      order: {
        expectedCodAmount: 104,
        totalAmount: 104,
        currencyCode: "PEN",
        collectedCodAmount: 0,
      },
    });
    assert.equal(first.ok, true);
    if (first.ok) assert.equal(first.mode, "full");

    const again = gateConfirmCollectedRemesa({
      remesaAmount: 104,
      itemCurrency: "PEN",
      order: {
        expectedCodAmount: 104,
        totalAmount: 104,
        currencyCode: "PEN",
        collectedCodAmount: 104,
      },
    });
    assert.equal(again.ok, false);

    assert.equal(
      decideSettlementCollectedAction({
        collectedAppliedAt: "2026-10-09T12:00:00.000Z",
        matchStatus: "matched",
        orderId: order.id,
        paymentStatus: "cash_collected",
      }),
      "skip_already_applied",
    );
    assert.equal(
      decideSettlementCollectedAction({
        collectedAppliedAt: null,
        matchStatus: "matched",
        orderId: order.id,
        paymentStatus: "settled",
      }),
      "skip_already_collected",
    );
  });

  it("does not settle an order from an unmatched CSV or Flipy row", () => {
    const match = matchSettlementRow(
      {
        sourceRowNumber: 2,
        trackingNumber: "TRACK-NO-EXISTE",
        externalShipmentId: null,
        externalOrderId: "9999",
        orderNumber: "9999",
        grossAmount: 50,
        feeAmount: 4,
        currencyCode: "PEN",
        occurredAt: "2026-10-09T12:00:00.000Z",
      },
      [order],
      [],
      new Set(),
    );
    assert.equal(match.matchStatus, "unmatched");
    assert.equal(match.orderId, null);
    assert.equal(
      decideSettlementCollectedAction({
        collectedAppliedAt: null,
        matchStatus: match.matchStatus,
        orderId: match.orderId,
        paymentStatus: "cash_expected",
      }),
      "skip_unmatched",
    );
  });

  it("writes a Shopify plan and refuses to replace an active Stripe subscription", () => {
    const mapped = mapShopifyActiveSubscription(
      {
        billingPeriod: "EVERY_30_DAYS",
        cancelAtEndOfCycle: false,
        trialEndsAt: null,
        currentBillingCycle: {
          startTime: "2026-10-01T00:00:00.000Z",
          endTime: "2026-11-01T00:00:00.000Z",
        },
        items: [{ handle: "growth" }],
        pendingUpdate: null,
        legacySubscriptionId: "gid://shopify/AppSubscription/1",
      },
      { shopGid: "gid://shopify/Shop/9" },
    );
    assert.equal(mapped.planCode, "growth");
    assert.equal(mapped.status, "active");
    assert.deepEqual(decideShopifySubscriptionSync(null), { sync: true });
    assert.deepEqual(decideShopifySubscriptionSync("demo"), { sync: true });
    assert.deepEqual(decideShopifySubscriptionSync("shopify"), { sync: true });
    assert.deepEqual(decideShopifySubscriptionSync("stripe"), {
      sync: false,
      reason: "agency_uses_stripe",
    });
  });

  it("opens Shopify Admin from the console and does not start Stripe Checkout", () => {
    const chrome = resolveConsoleBillingChrome("shopify");
    assert.equal(chrome.planCtaOpensShopify, true);
    assert.equal(chrome.planCtaLabel({ current: false, selfServe: true }), "Elegir en Shopify");
    assert.equal(chrome.manageLabel, "Administrar en Shopify");
    assert.equal(chrome.hideStripeInvoiceExpectation, true);
    assert.match(chrome.platformNote, /No uses Stripe Checkout/);
  });
});
