import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { escapeCsvFormula, parseCsv, serializeCsv, toCsvCell } from "@/lib/reconciliation/csv";
import {
  applyCollectedPatch,
  applyReopenPatch,
  applySettledPatch,
} from "@/lib/reconciliation/effects";
import { matchSettlementRows, rollupBatchStatus } from "@/lib/reconciliation/matching";
import { validateSettlementRows } from "@/lib/reconciliation/validate-rows";
import { generateMockSettlementCsv } from "@/lib/reconciliation/mock-csv";
import { getPreset } from "@/lib/reconciliation/presets";
import { rowsToObjects } from "@/lib/reconciliation/csv";

describe("reconciliation csv parser", () => {
  it("parses quoted commas and escaped quotes", () => {
    const { headers, rows } = parseCsv('a,b\n"hello, world","say ""hi"""\n');
    assert.deepEqual(headers, ["a", "b"]);
    assert.deepEqual(rows[0], ["hello, world", 'say "hi"']);
  });

  it("strips BOM and handles CRLF", () => {
    const { headers, rows } = parseCsv("\uFEFFx,y\r\n1,2\r\n");
    assert.deepEqual(headers, ["x", "y"]);
    assert.deepEqual(rows[0], ["1", "2"]);
  });

  it("prevents formula injection on export", () => {
    assert.equal(escapeCsvFormula("=1+1"), "'=1+1");
    assert.equal(escapeCsvFormula("+cmd"), "'+cmd");
    assert.equal(toCsvCell("@SUM(A1)"), "'@SUM(A1)");
    const csv = serializeCsv(["name"], [["=HYPERLINK(\"x\")"]]);
    assert.ok(csv.includes("'=HYPERLINK"));
  });
});

describe("reconciliation validate + match", () => {
  it("validates mock CSV and flags in-file duplicates", () => {
    const csv = generateMockSettlementCsv({ trackingExact: "TRK-A", orderNumber: "ORD-A", expectedAmount: 100 });
    const parsed = parseCsv(csv);
    const objects = rowsToObjects(parsed.headers, parsed.rows);
    const preset = getPreset("generic_cod")!;
    const result = validateSettlementRows(objects, preset.mapping);
    assert.ok(result.rows.length >= 5);
    assert.ok(result.errors.some((e) => e.code === "DUPLICATE_IN_FILE"));
    assert.ok(result.errors.some((e) => e.code === "MISSING_KEY"));
  });

  it("matches by priority: tracking > external > order_number; amount+time is suggestion only", () => {
    const orders = [
      {
        id: "o1",
        orderNumber: "ORD-1",
        externalOrderId: "EXT-1",
        expectedCodAmount: 100,
        collectedCodAmount: null,
        currencyCode: "PEN",
        createdAt: "2026-07-01T00:00:00.000Z",
        deliveredAt: "2026-07-02T00:00:00.000Z",
      },
      {
        id: "o2",
        orderNumber: "ORD-2",
        externalOrderId: "EXT-2",
        expectedCodAmount: 50,
        collectedCodAmount: null,
        currencyCode: "PEN",
        createdAt: "2026-07-01T00:00:00.000Z",
        deliveredAt: "2026-07-02T00:00:00.000Z",
      },
    ];
    const shipments = [
      { id: "s1", orderId: "o1", trackingNumber: "TRK-1", externalShipmentId: "SHIP-1" },
      { id: "s2", orderId: "o2", trackingNumber: "TRK-2", externalShipmentId: "SHIP-2" },
    ];

    const results = matchSettlementRows(
      [
        {
          sourceRowNumber: 2,
          trackingNumber: "TRK-1",
          externalShipmentId: null,
          externalOrderId: null,
          orderNumber: "ORD-OTHER",
          grossAmount: 100,
          feeAmount: 5,
          currencyCode: "PEN",
          occurredAt: "2026-07-02T00:00:00.000Z",
        },
        {
          sourceRowNumber: 3,
          trackingNumber: null,
          externalShipmentId: null,
          externalOrderId: null,
          orderNumber: null,
          grossAmount: 50,
          feeAmount: 1,
          currencyCode: "PEN",
          occurredAt: "2026-07-02T00:00:00.000Z",
        },
        {
          sourceRowNumber: 4,
          trackingNumber: "TRK-1",
          externalShipmentId: null,
          externalOrderId: null,
          orderNumber: null,
          grossAmount: 100,
          feeAmount: 5,
          currencyCode: "PEN",
          occurredAt: null,
          duplicateInFile: true,
        },
        {
          sourceRowNumber: 5,
          trackingNumber: "TRK-2",
          externalShipmentId: null,
          externalOrderId: null,
          orderNumber: null,
          grossAmount: 40,
          feeAmount: 1,
          currencyCode: "PEN",
          occurredAt: null,
        },
      ],
      orders,
      shipments,
    );

    assert.equal(results[0]!.matchStatus, "matched");
    assert.equal(results[0]!.matchMethod, "tracking");
    assert.equal(results[1]!.matchMethod, "amount_time_suggestion");
    assert.equal(results[1]!.matchStatus, "unmatched");
    assert.ok((results[1]!.matchConfidence ?? 0) < 0.5);
    assert.equal(results[2]!.matchStatus, "duplicate");
    assert.equal(results[3]!.matchStatus, "difference");
    assert.equal(results[3]!.discrepancyReason, "amount_lower_than_expected");
  });

  it("rollups batch status", () => {
    assert.equal(rollupBatchStatus(["matched", "matched"]), "matched");
    assert.equal(rollupBatchStatus(["matched", "unmatched"]), "partially_matched");
    assert.equal(rollupBatchStatus(["disputed"]), "disputed");
    assert.equal(rollupBatchStatus(["unmatched"]), "open");
  });
});

describe("reconciliation domain effects", () => {
  const baseOrder = {
    id: "o1",
    expectedCodAmount: 100,
    collectedCodAmount: null,
    settledCodAmount: null,
    paymentStatus: "cash_expected" as const,
    costOfGoodsAmount: 30,
    shippingCostAmount: 10,
    returnCostAmount: null,
    feeAmount: 5,
  };

  it("collected updates payment without settling", () => {
    const patch = applyCollectedPatch({ order: baseOrder, collectedAmount: 100 });
    assert.equal(patch.payment_status, "cash_collected");
    assert.equal(patch.collected_cod_amount, 100);
    assert.equal(patch.settled_cod_amount, undefined);
    assert.equal(patch.contribution_margin_amount, 55);
  });

  it("approval settles and reopen clears settled safely", () => {
    const collected = applyCollectedPatch({ order: baseOrder, collectedAmount: 100 });
    const settled = applySettledPatch({
      order: { ...baseOrder, collectedCodAmount: collected.collected_cod_amount ?? null, paymentStatus: collected.payment_status },
      settledAmount: 95,
    });
    assert.equal(settled.payment_status, "settled");
    assert.equal(settled.settled_cod_amount, 95);

    const reopened = applyReopenPatch({
      ...baseOrder,
      collectedCodAmount: 100,
      settledCodAmount: 95,
      paymentStatus: "settled",
    });
    assert.equal(reopened.settled_cod_amount, null);
    assert.equal(reopened.payment_status, "cash_collected");
    assert.equal(reopened.collected_cod_amount, undefined);
  });
});
