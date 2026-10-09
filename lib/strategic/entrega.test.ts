import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { evaluateFlipyAutoCreate } from "@/lib/integrations/flipy/auto-create";
import {
  FLIPY_DEFAULT_MAPPINGS,
  resolveFlipyExternalStatusCode,
} from "@/lib/integrations/flipy/map-status";
import { resolveShopifyFlipyPayment } from "@/lib/integrations/flipy/resolve-payment";
import {
  ENVIA_DEFAULT_MAPPINGS,
  resolveEnviaExternalStatusCode,
} from "@/lib/integrations/envia/map-status";
import { applyMapping, planShipmentEventApply } from "@/lib/logistics/normalize";

const coords = { lat: -12.12, lng: -77.03 };

function shipment(status: "delivered" | "in_transit", lastEventAt: string) {
  return {
    id: "ship-1",
    status,
    is_terminal: status === "delivered",
    is_rto: false,
    delivery_attempts: 1,
    last_event_at: lastEventAt,
    metadata: {},
    order_id: "order-1",
    store_id: "store-1",
    agency_id: "agency-1",
    carrier_id: "carrier-1",
  };
}

/**
 * Strategic group 4 — Entrega.
 * A confirmed order becomes a Flipy shipment only when the rules allow it.
 * Carrier events from Flipy and Envia share one status model, and an older
 * event cannot walk a delivered order backwards.
 */
describe("strategic · entrega", () => {
  it("does not auto-create a Flipy shipment for pickup, a disabled store, or a weak address", () => {
    const prepaid = resolveShopifyFlipyPayment({
      payment_kind: "prepaid",
      subtotal_amount: 75,
      shipping_amount: 18,
      total_amount: 93,
      expected_cod_amount: null,
      shipping_lines: [{ title: "Envío Lima" }],
    });
    assert.equal(
      evaluateFlipyAutoCreate({
        enabled: false,
        minConfidence: "high",
        flipyEnvioId: null,
        payment: prepaid,
        destinationCoords: coords,
        destinationAddress: "Av. Larco 123",
      }).skipReason,
      "disabled",
    );

    const pickup = resolveShopifyFlipyPayment({
      payment_kind: "cod",
      subtotal_amount: 40,
      shipping_amount: 0,
      total_amount: 40,
      shipping_lines: [{ title: "Recojo en tienda" }],
    });
    assert.equal(pickup.fulfillmentMode, "pickup");
    assert.equal(
      evaluateFlipyAutoCreate({
        enabled: true,
        minConfidence: "high",
        flipyEnvioId: null,
        payment: pickup,
        destinationCoords: null,
        destinationAddress: "",
      }).skipReason,
      "pickup",
    );

    assert.equal(
      evaluateFlipyAutoCreate({
        enabled: true,
        minConfidence: "high",
        flipyEnvioId: null,
        payment: { ...prepaid, confidence: "low" },
        destinationCoords: coords,
        destinationAddress: "Av. Larco 123",
      }).skipReason,
      "low_confidence",
    );
  });

  it("builds escenario 1A when checkout already paid product and freight, and 1E for COD", () => {
    const prepaid = resolveShopifyFlipyPayment({
      payment_kind: "prepaid",
      subtotal_amount: 75,
      shipping_amount: 18,
      total_amount: 93,
      expected_cod_amount: null,
      shipping_lines: [{ title: "Envío Lima" }],
    });
    assert.equal(prepaid.suggestedEscenario, "1A");
    assert.equal(prepaid.flipyFulfillmentMode, "smart");
    assert.equal(prepaid.productPaidAtCheckout, true);
    const created = evaluateFlipyAutoCreate({
      enabled: true,
      minConfidence: "high",
      flipyEnvioId: null,
      payment: prepaid,
      destinationCoords: coords,
      destinationAddress: "Av. Larco 123",
    });
    assert.equal(created.eligible, true);
    assert.equal(created.escenarioPago, "1A");

    const cod = resolveShopifyFlipyPayment({
      payment_kind: "cod",
      subtotal_amount: 89,
      shipping_amount: 15,
      total_amount: 104,
      expected_cod_amount: 104,
      shipping_lines: [{ title: "Envío Lima" }],
    });
    assert.equal(cod.suggestedEscenario, "1E");
    assert.equal(cod.flipyFulfillmentMode, "bid");
    assert.equal(cod.productPaidAtCheckout, false);
    assert.equal(cod.requiresUserConfirmation, true);
    assert.equal(
      evaluateFlipyAutoCreate({
        enabled: true,
        minConfidence: "high",
        flipyEnvioId: null,
        payment: cod,
        destinationCoords: coords,
        destinationAddress: "Av. Larco 123",
      }).skipReason,
      "requires_confirmation",
    );
  });

  it("keeps a delivered shipment when an older in-transit event arrives", () => {
    const plan = planShipmentEventApply({
      shipment: shipment("delivered", "2026-10-09T18:00:00.000Z"),
      externalStatusCode: "EN_CURSO",
      occurredAt: "2026-10-09T12:00:00.000Z",
      mappings: [...FLIPY_DEFAULT_MAPPINGS],
    });
    assert.equal(plan.skipStatusUpdate, true);
    assert.equal(plan.conflict, true);
    assert.equal(plan.nextShipment.status, "delivered");
    assert.equal(plan.orderPatch, null);
  });

  it("normalizes Flipy and Envia onto the same shipment status and never delivers an unknown code", () => {
    const flipyDelivered = applyMapping(
      resolveFlipyExternalStatusCode("ENTREGADO"),
      [...FLIPY_DEFAULT_MAPPINGS],
    );
    const enviaDelivered = applyMapping(
      resolveEnviaExternalStatusCode("entregado al cliente"),
      [...ENVIA_DEFAULT_MAPPINGS],
    );
    assert.equal(flipyDelivered.normalizedStatus, "delivered");
    assert.equal(enviaDelivered.normalizedStatus, "delivered");
    assert.equal(flipyDelivered.isTerminal, true);
    assert.equal(enviaDelivered.isTerminal, true);

    const unknown = planShipmentEventApply({
      shipment: shipment("in_transit", "2026-10-09T12:00:00.000Z"),
      externalStatusCode: "CODIGO_QUE_NO_EXISTE",
      occurredAt: "2026-10-09T13:00:00.000Z",
      mappings: [...FLIPY_DEFAULT_MAPPINGS],
    });
    assert.equal(unknown.normalize.normalizedStatus, "unknown");
    assert.equal(unknown.orderPatch, null);
    assert.notEqual(unknown.nextShipment.status, "delivered");
  });
});
