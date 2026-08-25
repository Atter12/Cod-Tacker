import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  FLIPY_PARTNER_CONTRACT_VERSION,
  buildFlipyCotizarRequestBody,
  buildFlipyCreateEnvioRequestBody,
  buildFlipyProvisionRequestBody,
  readFlipyCotizarEnvioResult,
  readFlipyCreateEnvioResult,
  readFlipyFleteQuote,
  readFlipySaldoOperaciones,
  readFlipySaldoReservado,
} from "@/lib/integrations/flipy/partner-contract";

describe("flipy partner contract", () => {
  it("uses Partner API contract version 0.2.0", () => {
    assert.equal(FLIPY_PARTNER_CONTRACT_VERSION, "0.2.0");
  });

  it("builds provision body for Flipy Partner API", () => {
    const body = buildFlipyProvisionRequestBody({
      externalStoreId: "store-uuid",
      nombre: "Mi Tienda",
      contactEmail: "ops@tienda.pe",
      telefono: "51999888777",
      ruc: "20123456789",
      originAddress: "Av. Larco 123, Miraflores",
      originLat: -12.119,
      originLng: -77.029,
      webhookUrl: "https://app.codtracked.com/api/webhooks/flipy/a/s",
    });

    assert.equal(body.externalStoreId, "store-uuid");
    assert.equal(body.nombre, "Mi Tienda");
    assert.equal(body.contactEmail, "ops@tienda.pe");
    assert.equal(body.telefono, "51999888777");
    assert.equal(body.contactPhone, "51999888777");
    assert.equal(body.ruc, "20123456789");
    assert.deepEqual(body.originLocation, {
      address: "Av. Larco 123, Miraflores",
      lat: -12.119,
      lng: -77.029,
    });
    assert.equal(body.direccion, "Av. Larco 123, Miraflores");
    assert.equal(body.webhookUrl, "https://app.codtracked.com/api/webhooks/flipy/a/s");
    assert.equal("email" in body, false);
    assert.equal("originAddress" in body, false);
  });

  it("rejects provision without contactEmail", () => {
    assert.throws(
      () =>
        buildFlipyProvisionRequestBody({
          externalStoreId: "x",
          nombre: "Tienda",
          contactEmail: "   ",
          originAddress: "Lima",
          originLat: -12,
          originLng: -77,
        }),
      /contactEmail/,
    );
  });

  it("reads billeteraOperaciones from Flipy saldo response", () => {
    assert.equal(readFlipySaldoOperaciones({ billeteraOperaciones: 150.5 }), 150.5);
    assert.equal(readFlipySaldoOperaciones({ saldoOperaciones: 99 }), 99);
    assert.equal(readFlipySaldoOperaciones({ billetera: { billeteraOperaciones: 42 } }), 42);
    assert.equal(readFlipySaldoOperaciones({}), 0);
  });

  it("reads billeteraReservado from Flipy saldo response", () => {
    assert.equal(readFlipySaldoReservado({ billeteraReservado: 12 }), 12);
    assert.equal(readFlipySaldoReservado({ saldo: { billetera_reservado: 8 } }), 8);
    assert.equal(readFlipySaldoReservado({}), null);
  });
});

describe("flipy partner client v0.2 bodies", () => {
  it("builds cotizar request per §3.2", () => {
    const body = buildFlipyCotizarRequestBody({
      originLat: -12.119,
      originLng: -77.029,
      destinationLat: -12.096,
      destinationLng: -77.028,
      packageSize: "mediano",
      typeMode: "express",
    });

    assert.deepEqual(body, {
      originLat: -12.119,
      originLng: -77.029,
      destinationLat: -12.096,
      destinationLng: -77.028,
      packageSize: "mediano",
      typeMode: "express",
    });
  });

  it("defaults cotizar typeMode to express", () => {
    const body = buildFlipyCotizarRequestBody({
      originLat: -12.119,
      originLng: -77.029,
      destinationLat: -12.096,
      destinationLng: -77.028,
      packageSize: "pequeno",
    });
    assert.equal(body.typeMode, "express");
  });

  it("parses cotizar response fleteQuote", () => {
    const parsed = readFlipyCotizarEnvioResult({
      success: true,
      fleteQuote: {
        version: 2,
        recommendedFare: 14.5,
        marketLow: 12.25,
        marketHigh: 17.4,
        minOffer: 10.15,
        maxOffer: 43.5,
        distanceKm: 3.2,
        durationMinutes: 12,
        packageSize: "mediano",
        typeMode: "express",
        source: "directions",
      },
    });

    assert.ok(parsed);
    assert.equal(parsed?.success, true);
    assert.equal(parsed?.fleteQuote.recommendedFare, 14.5);
    assert.equal(parsed?.fleteQuote.version, 2);
    assert.equal(parsed?.fleteQuote.source, "directions");
  });

  it("builds create envío v0.2 body with smart + shopifyPayment completo", () => {
    const fleteQuote = {
      version: 2,
      recommendedFare: 14.5,
      marketLow: 12.25,
      marketHigh: 17.4,
      minOffer: 10.15,
      maxOffer: 43.5,
      distanceKm: 3.2,
      durationMinutes: 12,
      packageSize: "mediano" as const,
      typeMode: "express" as const,
      source: "directions",
    };

    const body = buildFlipyCreateEnvioRequestBody({
      externalStoreId: "store-uuid",
      externalOrderId: "shopify:7123456789",
      orderNumber: "#1042",
      title: "#1042",
      escenarioPago: "1A",
      fulfillmentMode: "smart",
      priceLocked: true,
      codAmount: 0,
      price: 14.5,
      originAddress: "Av. Larco 123, Miraflores",
      originLat: -12.119,
      originLng: -77.029,
      originContact: "Mi Tienda",
      originPhone: "51987654321",
      destinationAddress: "Calle Las Flores 456, Surco",
      destinationLat: -12.096,
      destinationLng: -77.028,
      destinationContact: "Juan Pérez",
      destinationPhone: "51999888777",
      destinationEmail: "juan@example.com",
      packageSize: "mediano",
      packageCare: ["fragil", "vertical"],
      packageCareNote: "No acostar la caja",
      typeMode: "express",
      fleteQuote,
      shopifyPayment: {
        productPaidAtCheckout: true,
        shippingPaidAtCheckout: true,
        shopifySubtotal: 70.85,
        shopifyShippingAmount: 15,
        expectedCodProduct: 0,
        expectedCodShipping: 0,
        paymentKind: "prepaid",
        confirmedEscenario: "1A",
        noteAttributes: [],
      },
    });

    assert.equal(body.externalStoreId, "store-uuid");
    assert.equal(body.externalOrderId, "shopify:7123456789");
    assert.equal(body.fulfillmentMode, "smart");
    assert.equal(body.priceLocked, true);
    assert.equal(body.packageSize, "mediano");
    assert.deepEqual(body.packageCare, ["fragil", "vertical"]);
    assert.equal(body.packageCareNote, "No acostar la caja");
    assert.equal(body.destinationEmail, "juan@example.com");
    assert.equal(body.title, "#1042");
    assert.deepEqual(body.fleteQuote, fleteQuote);
    assert.deepEqual(body.shopifyPayment, {
      productPaidAtCheckout: true,
      shippingPaidAtCheckout: true,
      shopifySubtotal: 70.85,
      shopifyShippingAmount: 15,
      expectedCodProduct: 0,
      expectedCodShipping: 0,
      paymentKind: "prepaid",
      confirmedEscenario: "1A",
      noteAttributes: [],
    });
  });

  it("builds bid create body with COD shopifyPayment parcial", () => {
    const body = buildFlipyCreateEnvioRequestBody({
      externalStoreId: "store-uuid",
      externalOrderId: "shopify:7123456790",
      escenarioPago: "1E",
      fulfillmentMode: "bid",
      priceLocked: false,
      codAmount: 70.85,
      price: 16,
      originAddress: "Av. Larco 123",
      originLat: -12.119,
      originLng: -77.029,
      destinationAddress: "Surco",
      destinationLat: -12.096,
      destinationLng: -77.028,
      packageSize: "grande",
      packageCare: ["vidrio"],
      shopifyPayment: {
        productPaidAtCheckout: false,
        shippingPaidAtCheckout: false,
        shopifySubtotal: 70.85,
        shopifyShippingAmount: 15,
        expectedCodProduct: 70.85,
        expectedCodShipping: 15,
        paymentKind: "cod",
        confirmedEscenario: "1E",
      },
    });

    assert.equal(body.fulfillmentMode, "bid");
    assert.equal(body.priceLocked, false);
    assert.equal(body.codAmount, 70.85);
    assert.equal(body.packageSize, "grande");
    assert.deepEqual(body.packageCare, ["vidrio"]);
    assert.equal(body.fleteQuote, undefined);
    assert.equal((body.shopifyPayment as { expectedCodProduct: number }).expectedCodProduct, 70.85);
  });

  it("truncates packageCareNote to 120 chars", () => {
    const body = buildFlipyCreateEnvioRequestBody({
      externalStoreId: "store-uuid",
      externalOrderId: "shopify:1",
      escenarioPago: "1E",
      originAddress: "Origen",
      originLat: -12.1,
      originLng: -77,
      destinationAddress: "Destino",
      destinationLat: -12.2,
      destinationLng: -77.1,
      packageCareNote: "x".repeat(140),
    });
    assert.equal(typeof body.packageCareNote, "string");
    assert.equal((body.packageCareNote as string).length, 120);
  });

  it("parses create envío v0.2 response with assignedMotorizado", () => {
    const parsed = readFlipyCreateEnvioResult({
      success: true,
      contractVersion: "0.2.0",
      envioId: "clenv123",
      estado: "ASIGNADO",
      fulfillmentMode: "smart",
      trackingUrl: "https://app.flipy.pe/rastreo/cltk999",
      pujasWebUrl: null,
      assignedMotorizado: {
        id: "clmoto1",
        displayName: "Juan M.",
        etaMinutes: 12,
      },
      fleteQuote: { recommendedFare: 14.5, distanceKm: 3.2 },
    });

    assert.ok(parsed);
    assert.equal(parsed?.assignedMotorizado?.id, "clmoto1");
    assert.equal(parsed?.assignedMotorizado?.displayName, "Juan M.");
    assert.equal(parsed?.assignedMotorizado?.etaMinutes, 12);
  });

  it("parses create envío v0.2 response", () => {
    const parsed = readFlipyCreateEnvioResult({
      success: true,
      contractVersion: "0.2.0",
      envioId: "clenv123",
      estado: "ASIGNADO",
      fulfillmentMode: "smart",
      trackingUrl: "https://app.flipy.pe/rastreo/cltk999",
      pujasWebUrl: null,
      fleteQuote: { recommendedFare: 14.5, distanceKm: 3.2 },
    });

    assert.ok(parsed);
    assert.equal(parsed?.envioId, "clenv123");
    assert.equal(parsed?.contractVersion, "0.2.0");
    assert.equal(parsed?.fulfillmentMode, "smart");
    assert.equal(parsed?.estado, "ASIGNADO");
    assert.equal(parsed?.fleteQuote?.recommendedFare, 14.5);
    assert.equal(parsed?.pujasWebUrl, null);
  });

  it("readFlipyFleteQuote accepts snake_case fields", () => {
    const quote = readFlipyFleteQuote({
      flete_quote: {
        recommended_fare: 11.25,
        market_low: 9.5,
        distance_km: 2.1,
        package_size: "pequeno",
        type_mode: "express",
      },
    });
    assert.ok(quote);
    assert.equal(quote?.recommendedFare, 11.25);
    assert.equal(quote?.marketLow, 9.5);
    assert.equal(quote?.packageSize, "pequeno");
  });
});
