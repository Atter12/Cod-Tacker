import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  applyMapping,
  planShipmentEventApply,
  shouldProtectTerminal,
  type CarrierMappingRule,
} from "@/lib/logistics/normalize";

const mappings: CarrierMappingRule[] = [
  {
    external_status_code: "ENTREGADO",
    normalized_status: "delivered",
    is_rto: false,
    is_terminal: true,
    priority: 10,
  },
  {
    external_status_code: "DEVUELTO",
    normalized_status: "returned",
    is_rto: true,
    is_terminal: true,
  },
  {
    external_status_code: "FALLIDO",
    normalized_status: "delivery_failed",
    is_rto: false,
    is_terminal: false,
  },
  {
    external_status_code: "TRANSITO",
    normalized_status: "in_transit",
    is_rto: false,
    is_terminal: false,
  },
];

describe("applyMapping", () => {
  it("maps known codes case-insensitively", () => {
    const result = applyMapping("entregado", mappings);
    assert.equal(result.mapped, true);
    assert.equal(result.normalizedStatus, "delivered");
    assert.equal(result.isTerminal, true);
  });

  it("unknown codes become unknown and never delivered", () => {
    const result = applyMapping("XYZ_FOO", mappings);
    assert.equal(result.mapped, false);
    assert.equal(result.normalizedStatus, "unknown");
    assert.notEqual(result.normalizedStatus, "delivered");
  });
});

describe("shouldProtectTerminal", () => {
  it("blocks older events after terminal", () => {
    assert.equal(
      shouldProtectTerminal({
        currentStatus: "delivered",
        currentIsTerminal: true,
        currentLastEventAt: "2026-07-10T12:00:00.000Z",
        incomingStatus: "in_transit",
        incomingOccurredAt: "2026-07-10T10:00:00.000Z",
      }),
      true,
    );
  });

  it("allows same-status or newer non-regress when not older", () => {
    assert.equal(
      shouldProtectTerminal({
        currentStatus: "delivered",
        currentIsTerminal: true,
        currentLastEventAt: "2026-07-10T12:00:00.000Z",
        incomingStatus: "delivered",
        incomingOccurredAt: "2026-07-10T11:00:00.000Z",
      }),
      false,
    );
  });
});

describe("planShipmentEventApply", () => {
  const baseShipment = {
    id: "s1",
    status: "in_transit" as const,
    is_terminal: false,
    is_rto: false,
    delivery_attempts: 0,
    last_event_at: "2026-07-10T08:00:00.000Z",
    metadata: {},
    order_id: "o1",
    store_id: "st1",
    agency_id: "a1",
    carrier_id: "c1",
  };

  it("increments delivery_attempts on delivery_failed", () => {
    const plan = planShipmentEventApply({
      shipment: baseShipment,
      externalStatusCode: "FALLIDO",
      occurredAt: "2026-07-10T09:00:00.000Z",
      mappings,
    });
    assert.equal(plan.nextShipment.delivery_attempts, 1);
    assert.equal(plan.nextShipment.status, "delivery_failed");
  });

  it("sets RTO flags on returned and patches order", () => {
    const plan = planShipmentEventApply({
      shipment: baseShipment,
      externalStatusCode: "DEVUELTO",
      occurredAt: "2026-07-10T09:00:00.000Z",
      mappings,
    });
    assert.equal(plan.nextShipment.is_rto, true);
    assert.equal(plan.nextShipment.status, "returned");
    assert.equal(plan.orderPatch?.order_status, "returned");
    assert.ok(plan.orderPatch?.returned_at);
  });

  it("on delivered updates order carefully without payment fields", () => {
    const plan = planShipmentEventApply({
      shipment: baseShipment,
      externalStatusCode: "ENTREGADO",
      occurredAt: "2026-07-10T09:00:00.000Z",
      mappings,
    });
    assert.equal(plan.orderPatch?.order_status, "delivered");
    assert.ok(plan.orderPatch?.delivered_at);
    assert.equal("payment_status" in (plan.orderPatch ?? {}), false);
    assert.equal("settled_at" in (plan.orderPatch ?? {}), false);
  });

  it("records conflict and keeps terminal on out-of-order older event", () => {
    const plan = planShipmentEventApply({
      shipment: {
        ...baseShipment,
        status: "delivered",
        is_terminal: true,
        last_event_at: "2026-07-10T12:00:00.000Z",
        metadata: {},
      },
      externalStatusCode: "TRANSITO",
      occurredAt: "2026-07-10T09:00:00.000Z",
      mappings,
    });
    assert.equal(plan.conflict, true);
    assert.equal(plan.skipStatusUpdate, true);
    assert.equal(plan.nextShipment.status, "delivered");
    const meta = plan.nextShipment.metadata as { status_conflicts?: unknown[] };
    assert.ok(Array.isArray(meta.status_conflicts));
    assert.ok((meta.status_conflicts?.length ?? 0) > 0);
  });

  it("marks unmapped when code unknown", () => {
    const plan = planShipmentEventApply({
      shipment: baseShipment,
      externalStatusCode: "NO_MAP",
      occurredAt: "2026-07-10T09:00:00.000Z",
      mappings,
    });
    assert.equal(plan.unmapped, true);
    assert.equal(plan.nextShipment.status, "unknown");
  });
});
