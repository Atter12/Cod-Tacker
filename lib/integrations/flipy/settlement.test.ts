import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  FLIPY_PARTNER_CONTRACT_VERSION,
  readFlipySettlementBatch,
  readFlipySettlementWebhookPayload,
} from "@/lib/integrations/flipy/partner-contract";
import {
  mapFlipySettlementBatchToImportRows,
  mapFlipySettlementCsvToImportRows,
} from "@/lib/integrations/flipy/map-settlement";
import {
  isFlipySettlementWebhookEvent,
  mapFlipySettlementWebhookToJobPayload,
} from "@/lib/integrations/flipy/map-settlement-webhook";

describe("flipy settlement contract 0.2.3", () => {
  it("bumps partner contract version", () => {
    assert.equal(FLIPY_PARTNER_CONTRACT_VERSION, "0.2.3");
  });

  it("parses settlement.batch.ready webhook payload", () => {
    const batch = readFlipySettlementWebhookPayload({
      type: "settlement.batch.ready",
      data: {
        batchId: "flipy_batch_1",
        currency: "PEN",
        occurredAt: "2026-08-27T12:00:00.000Z",
        items: [
          {
            envioId: "clenv1",
            externalOrderId: "shopify:188752",
            tracking: "TRK-1",
            orderNumber: "1073",
            grossAmount: 70.34,
            feeAmount: 15,
            netAmount: 55.34,
            collectedAt: "2026-08-27T11:40:00.000Z",
          },
        ],
      },
    });
    assert.ok(batch);
    assert.equal(batch!.batchId, "flipy_batch_1");
    assert.equal(batch!.items.length, 1);
    assert.equal(batch!.items[0]!.grossAmount, 70.34);
  });

  it("parses cod.collected as single-item batch", () => {
    const batch = readFlipySettlementWebhookPayload({
      type: "cod.collected",
      data: {
        envioId: "e1",
        orderNumber: "99",
        grossAmount: 40,
        feeAmount: 5,
        netAmount: 35,
      },
    });
    assert.ok(batch);
    assert.equal(batch!.items.length, 1);
    assert.match(batch!.batchId, /^flipy-cod-/);
  });

  it("rejects zero/negative gross items", () => {
    const batch = readFlipySettlementBatch({
      batchId: "b1",
      currency: "PEN",
      items: [{ orderNumber: "1", grossAmount: 0, feeAmount: 0, netAmount: 0 }],
    });
    assert.equal(batch, null);
  });
});

describe("flipy map-settlement", () => {
  it("maps batch rows and strips shopify: prefix", () => {
    const batch = readFlipySettlementBatch({
      batchId: "b1",
      currency: "PEN",
      items: [
        {
          envioId: "clenv",
          externalOrderId: "shopify:188752",
          tracking: "T1",
          orderNumber: "1073",
          grossAmount: 70.34,
          feeAmount: 15,
          netAmount: 55.34,
          collectedAt: "2026-08-27T11:40:00.000Z",
        },
      ],
    });
    assert.ok(batch);
    const rows = mapFlipySettlementBatchToImportRows(batch!);
    assert.equal(rows.length, 1);
    assert.equal(rows[0]!.externalOrderId, "188752");
    assert.equal(rows[0]!.orderNumber, "1073");
    assert.equal(rows[0]!.grossAmount, 70.34);
    assert.equal(rows[0]!.feeAmount, 15);
    assert.equal(rows[0]!.netAmount, 55.34);
    assert.equal(rows[0]!.currencyCode, "PEN");
  });

  it("parses settlement CSV export", () => {
    const csv = [
      "tracking,order_number,external_order_id,external_shipment_id,gross_amount,fee_amount,net_amount,currency,date,reference",
      "T1,1073,shopify:188752,clenv,70.34,15,55.34,PEN,2026-08-27,",
    ].join("\n");
    const rows = mapFlipySettlementCsvToImportRows(csv);
    assert.equal(rows.length, 1);
    assert.equal(rows[0]!.externalOrderId, "188752");
    assert.equal(rows[0]!.grossAmount, 70.34);
  });
});

describe("flipy settlement webhook → job payload", () => {
  it("recognizes settlement event types", () => {
    assert.equal(isFlipySettlementWebhookEvent("settlement.batch.ready"), true);
    assert.equal(isFlipySettlementWebhookEvent("cod.collected"), true);
    assert.equal(isFlipySettlementWebhookEvent("shipment.created"), false);
  });

  it("builds settlement.flipy.synced job payload", () => {
    const mapped = mapFlipySettlementWebhookToJobPayload(
      {
        type: "settlement.batch.ready",
        data: {
          batchId: "flipy_batch_x",
          currency: "PEN",
          items: [
            {
              envioId: "e1",
              externalOrderId: "shopify:9",
              orderNumber: "1073",
              grossAmount: 10,
              feeAmount: 1,
              netAmount: 9,
            },
          ],
        },
      },
      { eventId: "evt-1" },
    );
    assert.equal(mapped.ok, true);
    if (!mapped.ok) return;
    assert.equal(mapped.payload.preset_id, "flipy_cod");
    assert.equal(mapped.payload.external_batch_id, "flipy_batch_x");
    assert.equal(mapped.payload.external_event_id, "evt-1");
    assert.equal(mapped.payload.rows.length, 1);
    assert.equal(mapped.payload.rows[0]!.externalOrderId, "9");
  });
});
