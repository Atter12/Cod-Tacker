import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  FLIPY_DEFAULT_MAPPINGS,
  resolveFlipyExternalStatusCode,
} from "@/lib/integrations/flipy/map-status";
import { resolveShopifyFlipyPayment } from "@/lib/integrations/flipy/resolve-payment";

describe("resolveShopifyFlipyPayment — F0-1 cases", () => {
  it("cod-full-total: COD clásico P+F", () => {
    const r = resolveShopifyFlipyPayment({
      payment_kind: "cod",
      subtotal_amount: 89,
      shipping_amount: 15,
      total_amount: 104,
      expected_cod_amount: 104,
      shipping_lines: [{ title: "Envío Lima" }],
    });
    assert.equal(r.fulfillmentMode, "delivery");
    assert.equal(r.suggestedEscenario, "1E");
    assert.equal(r.codAmount, 89);
    assert.equal(r.suggestedFlete, 15);
    assert.equal(r.confidence, "high");
    assert.equal(r.requiresUserConfirmation, true);
    assert.equal(r.productPaidAtCheckout, false);
  });

  it("cod-product-only: expected ≈ subtotal", () => {
    const r = resolveShopifyFlipyPayment({
      payment_kind: "cod",
      subtotal_amount: 120,
      shipping_amount: 12,
      total_amount: 132,
      expected_cod_amount: 120,
      shipping_lines: [{ title: "Envío" }],
    });
    assert.equal(r.suggestedEscenario, "1E");
    assert.equal(r.codAmount, 120);
    assert.equal(r.suggestedFlete, null);
    assert.equal(r.confidence, "medium");
  });

  it("prepaid-shipping: prepago producto + flete", () => {
    const r = resolveShopifyFlipyPayment({
      payment_kind: "prepaid",
      subtotal_amount: 75,
      shipping_amount: 18,
      total_amount: 93,
      expected_cod_amount: null,
      shipping_lines: [{ title: "Envío" }],
    });
    assert.equal(r.suggestedEscenario, "1A");
    assert.equal(r.codAmount, null);
    assert.equal(r.suggestedFlete, 18);
    assert.equal(r.productPaidAtCheckout, true);
    assert.equal(r.shippingPaidAtCheckout, true);
    assert.equal(r.confidence, "high");
    assert.equal(r.requiresUserConfirmation, false);
  });

  it("prepaid-free-shipping: prepago sin flete en checkout", () => {
    const r = resolveShopifyFlipyPayment({
      payment_kind: "prepaid",
      subtotal_amount: 55,
      shipping_amount: 0,
      total_amount: 55,
      expected_cod_amount: null,
    });
    assert.equal(r.suggestedEscenario, "1A");
    assert.equal(r.suggestedFlete, null);
    assert.equal(r.confidence, "medium");
    assert.equal(r.requiresUserConfirmation, true);
  });

  it("pickup-recojo: recojo en tienda", () => {
    const r = resolveShopifyFlipyPayment({
      payment_kind: "cod",
      subtotal_amount: 40,
      shipping_amount: 0,
      total_amount: 40,
      expected_cod_amount: 40,
      shipping_lines: [{ title: "Recojo en tienda" }],
    });
    assert.equal(r.fulfillmentMode, "pickup");
    assert.equal(r.suggestedEscenario, null);
    assert.equal(r.codAmount, null);
  });

  it("pickup-local: Shopify Local Pickup", () => {
    const r = resolveShopifyFlipyPayment({
      payment_kind: "prepaid",
      subtotal_amount: 99,
      shipping_amount: 0,
      total_amount: 99,
      shipping_lines: [{ title: "Local Pickup" }],
    });
    assert.equal(r.fulfillmentMode, "pickup");
    assert.equal(r.suggestedEscenario, null);
  });

  it("cod-tag-wins: payment_kind cod con gateway online", () => {
    const r = resolveShopifyFlipyPayment({
      payment_kind: "cod",
      subtotal_amount: 60,
      shipping_amount: 10,
      total_amount: 70,
      expected_cod_amount: 70,
      shipping_lines: [{ title: "Envío" }],
    });
    assert.equal(r.suggestedEscenario, "1E");
    assert.equal(r.codAmount, 60);
    assert.equal(r.suggestedFlete, 10);
  });

  it("cod-discount-ambiguous: descuento rompe total", () => {
    const r = resolveShopifyFlipyPayment({
      payment_kind: "cod",
      subtotal_amount: 100,
      shipping_amount: 15,
      total_amount: 105,
      expected_cod_amount: 90,
      shipping_lines: [{ title: "Envío" }],
    });
    assert.equal(r.suggestedEscenario, "1E");
    assert.equal(r.confidence, "low");
    assert.equal(r.requiresUserConfirmation, true);
    assert.equal(r.codAmount, 90);
  });

  it("prepaid-paid-financial: financial paid sin COD", () => {
    const r = resolveShopifyFlipyPayment({
      financialStatus: "paid",
      subtotal_amount: 45,
      shipping_amount: 8,
      total_amount: 53,
      shipping_lines: [{ title: "Envío" }],
    });
    assert.equal(r.suggestedEscenario, "1A");
    assert.equal(r.codAmount, null);
    assert.equal(r.suggestedFlete, 8);
    assert.equal(r.productPaidAtCheckout, true);
  });

  it("retiro-tienda: retiro en tienda español", () => {
    const r = resolveShopifyFlipyPayment({
      payment_kind: "cod",
      subtotal_amount: 30,
      shipping_amount: 0,
      total_amount: 30,
      expected_cod_amount: 30,
      shipping_lines: [{ title: "Retiro en tienda" }],
    });
    assert.equal(r.fulfillmentMode, "pickup");
    assert.equal(r.suggestedEscenario, null);
  });
});

describe("resolveShopifyFlipyPayment — edge cases", () => {
  it("derives cod from tags when payment_kind absent", () => {
    const r = resolveShopifyFlipyPayment({
      tags: ["COD", "lima"],
      subtotal_amount: 50,
      shipping_amount: 5,
      total_amount: 55,
      shipping_lines: [{ title: "Standard" }],
    });
    assert.equal(r.suggestedEscenario, "1E");
    assert.equal(r.codAmount, 50);
  });

  it("pickup via shipping line code", () => {
    const r = resolveShopifyFlipyPayment({
      payment_kind: "cod",
      subtotal_amount: 20,
      total_amount: 20,
      shipping_lines: [{ code: "local_pickup" }],
    });
    assert.equal(r.fulfillmentMode, "pickup");
  });

  it("unknown fulfillment when no shipping lines", () => {
    const r = resolveShopifyFlipyPayment({
      payment_kind: "cod",
      subtotal_amount: 80,
      shipping_amount: 10,
      total_amount: 90,
      expected_cod_amount: 90,
    });
    assert.equal(r.fulfillmentMode, "unknown");
    assert.equal(r.suggestedEscenario, "1E");
  });

  it("tolerance ±0.05 on amount comparison", () => {
    const r = resolveShopifyFlipyPayment({
      payment_kind: "cod",
      subtotal_amount: 89.02,
      shipping_amount: 15,
      total_amount: 104.02,
      expected_cod_amount: 104,
      shipping_lines: [{ title: "Envío" }],
    });
    assert.equal(r.confidence, "high");
    assert.equal(r.codAmount, 89.02);
  });

  it("cod zero subtotal: solo flete COD", () => {
    const r = resolveShopifyFlipyPayment({
      payment_kind: "cod",
      subtotal_amount: 0,
      shipping_amount: 12,
      total_amount: 12,
      expected_cod_amount: 12,
      shipping_lines: [{ title: "Solo envío" }],
    });
    assert.equal(r.suggestedEscenario, "1E");
    assert.equal(r.codAmount, null);
    assert.equal(r.suggestedFlete, 12);
  });

  it("F3-05: note_attributes escenario override", () => {
    const r = resolveShopifyFlipyPayment({
      payment_kind: "cod",
      subtotal_amount: 89,
      shipping_amount: 15,
      total_amount: 104,
      expected_cod_amount: 104,
      shipping_lines: [{ title: "Envío" }],
      note_attributes: [{ name: "flipy_escenario", value: "1A" }],
    });
    assert.equal(r.suggestedEscenario, "1A");
    assert.ok(r.reasons.includes("note_attribute_escenario_override"));
    assert.equal(r.requiresUserConfirmation, false);
  });

  it("F3-04: custom pickup keywords from integration settings", () => {
    const r = resolveShopifyFlipyPayment({
      payment_kind: "cod",
      subtotal_amount: 50,
      total_amount: 50,
      shipping_lines: [{ title: "Click and collect Lima" }],
      pickup_keywords: ["click and collect"],
    });
    assert.equal(r.fulfillmentMode, "pickup");
  });
});

describe("flipy map-status — F0-2", () => {
  it("maps all Flipy estados to valid CT normalized statuses", () => {
    const codes = FLIPY_DEFAULT_MAPPINGS.map((m) => m.external_status_code);
    assert.deepEqual(codes, [
      "BORRADOR",
      "PENDIENTE_PUJAS",
      "ASIGNADO",
      "EN_CURSO",
      "ENTREGADO",
      "CANCELADO",
    ]);
    assert.equal(
      FLIPY_DEFAULT_MAPPINGS.find((m) => m.external_status_code === "ENTREGADO")?.is_terminal,
      true,
    );
    assert.equal(
      FLIPY_DEFAULT_MAPPINGS.find((m) => m.external_status_code === "CANCELADO")?.normalized_status,
      "cancelled",
    );
  });

  it("resolveFlipyExternalStatusCode normalizes raw strings", () => {
    assert.equal(resolveFlipyExternalStatusCode("EN_CURSO"), "EN_CURSO");
    assert.equal(resolveFlipyExternalStatusCode("en curso"), "EN_CURSO");
    assert.equal(resolveFlipyExternalStatusCode(""), "UNKNOWN");
  });
});
