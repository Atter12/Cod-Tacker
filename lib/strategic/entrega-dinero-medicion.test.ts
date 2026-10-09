import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { planShipmentEventApply } from "@/lib/logistics/normalize";
import { FLIPY_DEFAULT_MAPPINGS } from "@/lib/integrations/flipy/map-status";
import {
  shouldFirePurchaseOnDelivered,
  shouldRecordPurchaseAfterSettlement,
} from "@/lib/conversions/delivered-purchase-policy";
import { decideSweepAction } from "@/lib/conversions/release-sweep-policy";
import { purchaseConversionEventId } from "@/lib/conversions/purchase-event-id";
import { decidePurchaseResend } from "@/lib/conversions/purchase-send-gate";
import { gateConfirmCollectedRemesa } from "@/lib/reconciliation/collected-gate";
import { matchSettlementRow } from "@/lib/reconciliation/matching";
import { decideSettlementCollectedAction } from "@/lib/reconciliation/settlement-apply-gate";

const ORDER_ID = "order-1";

/**
 * Strategic cross 4 — Entrega → Dinero → Medición.
 * Delivery does not emit Purchase. A matched full remesa collects once and
 * releases one Purchase for Meta and TikTok. A second pass does not send it again.
 */
describe("strategic · entrega → dinero → medición", () => {
  it("does not emit Purchase when the shipment is delivered but cash is still expected", () => {
    const delivered = planShipmentEventApply({
      shipment: {
        id: "ship-1",
        status: "in_transit",
        is_terminal: false,
        is_rto: false,
        delivery_attempts: 0,
        last_event_at: "2026-10-09T12:00:00.000Z",
        metadata: {},
        order_id: ORDER_ID,
        store_id: "store-1",
        agency_id: "agency-1",
        carrier_id: "carrier-1",
      },
      externalStatusCode: "ENTREGADO",
      occurredAt: "2026-10-09T18:00:00.000Z",
      mappings: [...FLIPY_DEFAULT_MAPPINGS],
    });
    assert.equal(delivered.nextShipment.status, "delivered");
    assert.equal(delivered.orderPatch?.order_status, "delivered");
    assert.equal("payment_status" in (delivered.orderPatch ?? {}), false);
    assert.equal(shouldFirePurchaseOnDelivered("cash_expected"), false);
    assert.equal(
      decideSweepAction({
        value: 104,
        orderStatus: "delivered",
        paymentStatus: "cash_expected",
        confirmationStatus: "confirmed",
      }).action,
      "hold",
    );
  });

  it("collects a matched remesa once and releases a single Purchase event", () => {
    const match = matchSettlementRow(
      {
        sourceRowNumber: 1,
        trackingNumber: "TRACK-1",
        externalShipmentId: null,
        externalOrderId: null,
        orderNumber: "1001",
        grossAmount: 104,
        feeAmount: 4,
        currencyCode: "PEN",
        occurredAt: "2026-10-09T19:00:00.000Z",
      },
      [
        {
          id: ORDER_ID,
          orderNumber: "1001",
          externalOrderId: "1001",
          expectedCodAmount: 104,
          collectedCodAmount: null,
          currencyCode: "PEN",
          createdAt: "2026-10-01T00:00:00.000Z",
          deliveredAt: "2026-10-09T18:00:00.000Z",
        },
      ],
      [{ id: "ship-1", orderId: ORDER_ID, trackingNumber: "TRACK-1", externalShipmentId: null }],
      new Set(),
    );
    assert.equal(match.matchStatus, "matched");
    assert.equal(match.orderId, ORDER_ID);
    assert.equal(
      decideSettlementCollectedAction({
        collectedAppliedAt: null,
        matchStatus: match.matchStatus,
        orderId: match.orderId,
        paymentStatus: "cash_expected",
      }),
      "apply",
    );

    const collected = gateConfirmCollectedRemesa({
      remesaAmount: 104,
      itemCurrency: "PEN",
      order: {
        expectedCodAmount: 104,
        totalAmount: 104,
        currencyCode: "PEN",
        collectedCodAmount: 0,
      },
    });
    assert.equal(collected.ok, true);
    if (!collected.ok) return;
    assert.equal(collected.mode, "full");
    assert.equal(shouldRecordPurchaseAfterSettlement(collected.mode), true);
    assert.equal(shouldRecordPurchaseAfterSettlement("partial"), false);

    const released = decideSweepAction({
      value: collected.newCollected,
      orderStatus: "delivered",
      paymentStatus: "cash_collected",
      confirmationStatus: "confirmed",
    });
    assert.equal(released.action, "release");

    const eventId = purchaseConversionEventId(ORDER_ID);
    assert.equal(eventId, "purchase:order-1");
    assert.equal(purchaseConversionEventId(ORDER_ID), eventId);

    assert.deepEqual(
      decidePurchaseResend({
        id: "evt-1",
        sentAt: "2026-10-09T19:05:00.000Z",
        releaseStatus: "released",
      }),
      { send: false, reason: "already_sent" },
    );
  });

  it("does not collect or release Purchase from an unmatched row or a second remesa", () => {
    const unmatched = matchSettlementRow(
      {
        sourceRowNumber: 2,
        trackingNumber: "NO-EXISTE",
        externalShipmentId: null,
        externalOrderId: "9999",
        orderNumber: "9999",
        grossAmount: 10,
        feeAmount: 0,
        currencyCode: "PEN",
        occurredAt: "2026-10-09T19:00:00.000Z",
      },
      [
        {
          id: ORDER_ID,
          orderNumber: "1001",
          externalOrderId: "1001",
          expectedCodAmount: 104,
          collectedCodAmount: 104,
          currencyCode: "PEN",
          createdAt: "2026-10-01T00:00:00.000Z",
          deliveredAt: "2026-10-09T18:00:00.000Z",
        },
      ],
      [],
      new Set(),
    );
    assert.equal(
      decideSettlementCollectedAction({
        collectedAppliedAt: null,
        matchStatus: unmatched.matchStatus,
        orderId: unmatched.orderId,
        paymentStatus: "cash_collected",
      }),
      "skip_unmatched",
    );

    const second = gateConfirmCollectedRemesa({
      remesaAmount: 104,
      itemCurrency: "PEN",
      order: {
        expectedCodAmount: 104,
        totalAmount: 104,
        currencyCode: "PEN",
        collectedCodAmount: 104,
      },
    });
    assert.equal(second.ok, false);
  });
});
