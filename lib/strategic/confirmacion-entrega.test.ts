import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { inferConfirmationFromBody } from "@/lib/whatsapp/templates";
import { evaluateFlipyAutoCreate } from "@/lib/integrations/flipy/auto-create";
import { resolveShopifyFlipyPayment } from "@/lib/integrations/flipy/resolve-payment";
import {
  FLIPY_DEFAULT_MAPPINGS,
  resolveFlipyExternalStatusCode,
} from "@/lib/integrations/flipy/map-status";
import {
  ENVIA_DEFAULT_MAPPINGS,
  resolveEnviaExternalStatusCode,
} from "@/lib/integrations/envia/map-status";
import { planShipmentEventApply } from "@/lib/logistics/normalize";

const coords = { lat: -12.12, lng: -77.03 };

const prepaid = resolveShopifyFlipyPayment({
  payment_kind: "prepaid",
  subtotal_amount: 75,
  shipping_amount: 18,
  total_amount: 93,
  expected_cod_amount: null,
  shipping_lines: [{ title: "Envío Lima" }],
});

function shipment(status: "created" | "delivered", lastEventAt: string) {
  return {
    id: "ship-1",
    status,
    is_terminal: status === "delivered",
    is_rto: false,
    delivery_attempts: status === "delivered" ? 1 : 0,
    last_event_at: lastEventAt,
    metadata: {},
    order_id: "order-1",
    store_id: "store-1",
    agency_id: "agency-1",
    carrier_id: "carrier-1",
  };
}

/**
 * Strategic cross 3 — Confirmación → Entrega.
 * A confirmed order can become a shipment. A rejected reply never does.
 * An older carrier event does not walk a delivered shipment backwards.
 */
describe("strategic · confirmación → entrega", () => {
  it("creates a Flipy shipment after the customer confirms and advances it in transit", () => {
    assert.equal(inferConfirmationFromBody("SI confirmo el pedido"), "confirmed");
    const created = evaluateFlipyAutoCreate({
      enabled: true,
      minConfidence: "high",
      flipyEnvioId: null,
      payment: prepaid,
      destinationCoords: coords,
      destinationAddress: "Av. Larco 123",
      confirmationStatus: "confirmed",
    });
    assert.equal(created.eligible, true);
    assert.equal(created.escenarioPago, "1A");

    const plan = planShipmentEventApply({
      shipment: shipment("created", "2026-10-09T12:00:00.000Z"),
      externalStatusCode: resolveFlipyExternalStatusCode("EN_CURSO"),
      occurredAt: "2026-10-09T14:00:00.000Z",
      mappings: [...FLIPY_DEFAULT_MAPPINGS],
    });
    assert.equal(plan.skipStatusUpdate, false);
    assert.equal(plan.nextShipment.status, "in_transit");
    assert.equal(plan.orderPatch?.order_status, "in_transit");
  });

  it("does not create a shipment when the customer rejects the order", () => {
    assert.equal(inferConfirmationFromBody("NO quiero el pedido"), "rejected");
    const skipped = evaluateFlipyAutoCreate({
      enabled: true,
      minConfidence: "high",
      flipyEnvioId: null,
      payment: prepaid,
      destinationCoords: coords,
      destinationAddress: "Av. Larco 123",
      confirmationStatus: "rejected",
    });
    assert.equal(skipped.eligible, false);
    assert.equal(skipped.skipReason, "confirmation_rejected");
    assert.equal(skipped.escenarioPago, null);
  });

  it("keeps a delivered Flipy or Envia shipment when an older transit event arrives", () => {
    const flipy = planShipmentEventApply({
      shipment: shipment("delivered", "2026-10-09T18:00:00.000Z"),
      externalStatusCode: resolveFlipyExternalStatusCode("en curso"),
      occurredAt: "2026-10-09T12:00:00.000Z",
      mappings: [...FLIPY_DEFAULT_MAPPINGS],
    });
    assert.equal(flipy.nextShipment.status, "delivered");
    assert.equal(flipy.orderPatch, null);

    const envia = planShipmentEventApply({
      shipment: shipment("delivered", "2026-10-09T18:00:00.000Z"),
      externalStatusCode: resolveEnviaExternalStatusCode("en tránsito"),
      occurredAt: "2026-10-09T12:00:00.000Z",
      mappings: [...ENVIA_DEFAULT_MAPPINGS],
    });
    assert.equal(envia.nextShipment.status, "delivered");
    assert.equal(envia.conflict, true);
    assert.equal(envia.orderPatch, null);
  });
});
