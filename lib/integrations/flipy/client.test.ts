import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  FLIPY_PARTNER_CONTRACT_VERSION,
  buildFlipyCalificarEnvioRequestBody,
  buildFlipyCancelEnvioRequestBody,
  buildFlipyConfirmarDevolucionRequestBody,
  buildFlipyCotizarRequestBody,
  buildFlipyCreateEnvioRequestBody,
  buildFlipyProvisionRequestBody,
  readFlipyCalificarEnvioSuccessResult,
  readFlipyCancelEnvioBlockedResult,
  readFlipyCancelEnvioSuccessResult,
  readFlipyConfirmarDevolucionSuccessResult,
  readFlipyCotizarEnvioResult,
  readFlipyCreateEnvioResult,
  readFlipyEnvioByExternalOrderResult,
  readFlipyEnvioSummaryResult,
  readFlipyTiendaResena,
  readFlipyFleteQuote,
  readFlipySaldoOperaciones,
  readFlipySaldoReservado,
  readFlipySaldoGanancias,
  readFlipyWalletSaldoResult,
  buildFlipyTransferGananciasRequestBody,
  readFlipyTransferGananciasSuccessResult,
  readFlipyActivateAccountInitResult,
  readFlipyTiendaProfileResult,
  buildFlipyActivateAccountInitRequestBody,
} from "@/lib/integrations/flipy/partner-contract";
import {
  isFlipyDevolucionPendienteConfirmacion,
  isFlipyImmediateCancelEstado,
  isFlipyTerminalEstado,
} from "@/lib/integrations/flipy/errors";

describe("flipy partner contract", () => {
  it("uses Partner API contract version 0.2.1", () => {
    assert.equal(FLIPY_PARTNER_CONTRACT_VERSION, "0.2.1");
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

  it("reads wallet saldo with ganancias and transfer flags", () => {
    const parsed = readFlipyWalletSaldoResult({
      success: true,
      billeteraOperaciones: 150,
      billeteraReservado: 12,
      billeteraGanancias: 89.5,
      ganancias: 89.5,
      transferGananciasDisponible: true,
      destinoRetiroConfigurado: false,
      canCreateEnvio: true,
      warnings: [],
    });

    assert.equal(parsed.billeteraOperaciones, 150);
    assert.equal(parsed.billeteraReservado, 12);
    assert.equal(parsed.billeteraGanancias, 89.5);
    assert.equal(parsed.transferGananciasDisponible, true);
    assert.equal(readFlipySaldoGanancias({ ganancias: 40 }), 40);
  });

  it("builds and parses transfer ganancias → operaciones", () => {
    assert.deepEqual(buildFlipyTransferGananciasRequestBody({ monto: 50 }), { monto: 50 });

    const parsed = readFlipyTransferGananciasSuccessResult({
      success: true,
      contractVersion: "0.2.0",
      idempotent: false,
      transferId: "cltxn123",
      monto: 50,
      billeteraOperaciones: 200,
      billeteraGanancias: 39.5,
      billeteraReservado: 12,
      saldo: {
        billeteraOperaciones: 200,
        billeteraGanancias: 39.5,
        billeteraReservado: 12,
      },
      message: "Transferiste S/ 50.00 de Ganancias a Operaciones",
    });

    assert.ok(parsed);
    assert.equal(parsed?.monto, 50);
    assert.equal(parsed?.billeteraOperaciones, 200);
    assert.equal(parsed?.billeteraGanancias, 39.5);
    assert.equal(parsed?.idempotent, false);
  });

  it("builds provision body with partner email trust v0.2.1", () => {
    const body = buildFlipyProvisionRequestBody({
      externalStoreId: "store-uuid",
      nombre: "Mi Tienda",
      contactEmail: "ops@tienda.pe",
      originAddress: "Av. Larco 123, Miraflores",
      originLat: -12.119,
      originLng: -77.029,
      emailVerifiedAt: "2026-08-27T12:00:00.000Z",
      partnerEmailAssertion: "jwt.assertion.token",
    });

    assert.equal(body.emailVerifiedAt, "2026-08-27T12:00:00.000Z");
    assert.equal(body.partnerEmailAssertion, "jwt.assertion.token");
  });

  it("builds activate-account init request body", () => {
    const body = buildFlipyActivateAccountInitRequestBody({
      contactEmail: "ops@tienda.pe",
      externalStoreId: "store-uuid",
      emailVerified: true,
      partnerEmailAssertion: "jwt.assertion.token",
    });

    assert.equal(body.contactEmail, "ops@tienda.pe");
    assert.equal(body.email, "ops@tienda.pe");
    assert.equal(body.externalStoreId, "store-uuid");
    assert.equal(body.emailVerified, true);
    assert.equal(body.partnerEmailAssertion, "jwt.assertion.token");
  });

  it("parses activate-account init response with otpRequired false", () => {
    const parsed = readFlipyActivateAccountInitResult({
      success: true,
      token: "act-token-xyz",
      activationUrl:
        "https://tienda.flipyexpress.com/activar-cuenta?email=ops@tienda.pe&token=act-token-xyz&source=codtracked&emailVerified=1",
      expiresAt: "2026-08-26T21:30:00.000Z",
      otpRequired: false,
    });

    assert.ok(parsed);
    assert.equal(parsed?.token, "act-token-xyz");
    assert.equal(parsed?.otpRequired, false);
    assert.match(parsed?.activationUrl ?? "", /activar-cuenta/);
  });

  it("parses tienda profile v0.2.1 activation fields", () => {
    const parsed = readFlipyTiendaProfileResult({
      tiendaId: "cmt7pgzcl0003bgtxm020y9nx",
      contactEmail: "ops@tienda.pe",
      nombre: "flipy",
      externalStoreId: "store-uuid",
      emailVerified: true,
      emailVerifiedAt: "2026-08-27T12:00:00.000Z",
      passwordSetAt: null,
      activationReady: true,
    });

    assert.ok(parsed);
    assert.equal(parsed?.contactEmail, "ops@tienda.pe");
    assert.equal(parsed?.emailVerified, true);
    assert.equal(parsed?.emailVerifiedAt, "2026-08-27T12:00:00.000Z");
    assert.equal(parsed?.passwordSetAt, null);
    assert.equal(parsed?.activationReady, true);
  });

  it("parses PATCH contact-email response as tienda profile", () => {
    const parsed = readFlipyTiendaProfileResult({
      success: true,
      contractVersion: "0.2.1",
      tiendaId: "tienda-1",
      contactEmail: "nuevo@tienda.pe",
      emailVerified: true,
      emailVerifiedAt: "2026-08-27T12:00:00.000Z",
      passwordSetAt: "2026-08-20T10:00:00.000Z",
      activationReady: false,
    });

    assert.ok(parsed);
    assert.equal(parsed?.contactEmail, "nuevo@tienda.pe");
    assert.equal(parsed?.passwordSetAt, "2026-08-20T10:00:00.000Z");
    assert.equal(parsed?.activationReady, false);
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

describe("flipy partner calificación contract", () => {
  it("builds calificar request body", () => {
    assert.deepEqual(buildFlipyCalificarEnvioRequestBody({ rating: 4, comentario: "Bien" }), {
      rating: 4,
      comentario: "Bien",
    });
    assert.deepEqual(buildFlipyCalificarEnvioRequestBody({ rating: 5 }), { rating: 5 });
  });

  it("parses calificar success response", () => {
    const parsed = readFlipyCalificarEnvioSuccessResult({
      success: true,
      envioId: "clenv123",
      estado: "ENTREGADO",
      idempotent: false,
      calificacionDisponible: false,
      calificacionPeso: 1,
      tiendaResena: {
        id: "clr1",
        rating: 4,
        peso: 1,
        comentario: "Llegó tarde pero bien",
        autorTipo: "TIENDA",
      },
      motorizado: {
        id: "clmoto1",
        calificacionPromedio: 4.72,
        totalCalificaciones: 38,
      },
      message: "Calificación enviada correctamente",
    });

    assert.ok(parsed);
    assert.equal(parsed?.tiendaResena?.rating, 4);
    assert.equal(parsed?.motorizado?.calificacionPromedio, 4.72);
    assert.equal(parsed?.calificacionDisponible, false);
  });

  it("parses idempotent calificar response", () => {
    const parsed = readFlipyCalificarEnvioSuccessResult({
      success: true,
      envioId: "clenv123",
      estado: "ENTREGADO",
      idempotent: true,
      message: "Ya calificaste a este motorizado en este envío",
      tiendaResena: { id: "clr1", rating: 5 },
    });

    assert.ok(parsed);
    assert.equal(parsed?.idempotent, true);
  });

  it("parses envío summary with calificación fields", () => {
    const parsed = readFlipyEnvioSummaryResult({
      envioId: "clenv123",
      estado: "CANCELADO",
      calificacionDisponible: true,
      calificacionPeso: 2,
      tiendaResena: null,
    });

    assert.ok(parsed);
    assert.equal(parsed?.calificacionDisponible, true);
    assert.equal(parsed?.calificacionPeso, 2);
    assert.equal(parsed?.tiendaResena, null);
  });

  it("parses tiendaResena", () => {
    const resena = readFlipyTiendaResena({
      id: "clr1",
      rating: 3,
      peso: 2,
      comentario: "OK",
      autorTipo: "TIENDA",
    });
    assert.ok(resena);
    assert.equal(resena?.peso, 2);
  });
});

describe("flipy partner devolución contract", () => {
  it("parses devolución from envío summary", () => {
    const parsed = readFlipyEnvioSummaryResult({
      envioId: "clenv123",
      estado: "EN_CURSO",
      devolucion: {
        estado: "PENDIENTE_CONFIRMACION_TIENDA",
        motivoId: "CLIENTE_AUSENTE",
        motivoLabel: "Cliente no disponible",
        pendienteConfirmacion: true,
      },
    });

    assert.ok(parsed);
    assert.equal(parsed?.devolucion?.motivoLabel, "Cliente no disponible");
    assert.equal(parsed?.devolucion?.pendienteConfirmacion, true);
  });

  it("parses confirmar-devolucion success response", () => {
    const parsed = readFlipyConfirmarDevolucionSuccessResult({
      success: true,
      contractVersion: "0.2.0",
      envioId: "clenv123",
      estado: "CANCELADO",
      estadoPrevio: "EN_CURSO",
      devolucionConfirmada: true,
      idempotent: false,
      montoLiberado: 15.66,
      devolucion: {
        estado: "CONFIRMADA",
        pendienteConfirmacion: false,
        confirmadaPor: "PARTNER",
      },
      message: "Devolución confirmada.",
    });

    assert.ok(parsed);
    assert.equal(parsed?.estado, "CANCELADO");
    assert.equal(parsed?.montoLiberado, 15.66);
    assert.equal(parsed?.devolucion?.estado, "CONFIRMADA");
  });

  it("builds optional confirmar-devolucion body", () => {
    assert.deepEqual(buildFlipyConfirmarDevolucionRequestBody({ notas: "Recibido OK" }), {
      notas: "Recibido OK",
    });
    assert.equal(buildFlipyConfirmarDevolucionRequestBody({}), undefined);
  });

  it("detects devolución pendiente de confirmación", () => {
    assert.equal(
      isFlipyDevolucionPendienteConfirmacion({ pendienteConfirmacion: true }),
      true,
    );
    assert.equal(
      isFlipyDevolucionPendienteConfirmacion({ estado: "PENDIENTE_CONFIRMACION_TIENDA" }),
      true,
    );
    assert.equal(isFlipyDevolucionPendienteConfirmacion({ pendienteConfirmacion: false }), false);
  });
});

describe("flipy partner cancel contract", () => {
  it("builds optional cancel body", () => {
    assert.deepEqual(
      buildFlipyCancelEnvioRequestBody({
        motivo: "CLIENTE_CANCELADO",
        motivoLabel: "Cliente canceló el pedido en Shopify",
        notas: "Pedido #1042 anulado",
      }),
      {
        motivo: "CLIENTE_CANCELADO",
        motivoLabel: "Cliente canceló el pedido en Shopify",
        notas: "Pedido #1042 anulado",
      },
    );
    assert.equal(buildFlipyCancelEnvioRequestBody({}), undefined);
  });

  it("parses cancel success response", () => {
    const parsed = readFlipyCancelEnvioSuccessResult({
      success: true,
      contractVersion: "0.2.0",
      envioId: "clenv123",
      estado: "CANCELADO",
      estadoPrevio: "PENDIENTE_PUJAS",
      cancelacionInmediata: true,
      idempotent: false,
      holdLiberado: true,
      message: "Envío cancelado.",
      appWebUrl: "https://tienda.flipyexpress.com/envios/clenv123",
    });

    assert.ok(parsed);
    assert.equal(parsed?.estado, "CANCELADO");
    assert.equal(parsed?.estadoPrevio, "PENDIENTE_PUJAS");
    assert.equal(parsed?.holdLiberado, true);
    assert.equal(parsed?.idempotent, false);
  });

  it("parses cancel blocked 409 response", () => {
    const parsed = readFlipyCancelEnvioBlockedResult({
      success: false,
      code: "CANCEL_BLOQUEADA_ASIGNADO",
      message: "Ya hay un motorizado asignado.",
      details: {
        envioId: "clenv123",
        estado: "ASIGNADO",
        appWebUrl: "https://tienda.flipyexpress.com/envios/clenv123",
        supportHint: "Abre el envío en Flipy.",
      },
    });

    assert.ok(parsed);
    assert.equal(parsed?.code, "CANCEL_BLOQUEADA_ASIGNADO");
    assert.equal(parsed?.details?.appWebUrl, "https://tienda.flipyexpress.com/envios/clenv123");
  });

  it("parses envio by external order", () => {
    const parsed = readFlipyEnvioByExternalOrderResult({
      envioId: "clenv123",
      estado: "PENDIENTE_PUJAS",
      externalOrderId: "shopify:7123456789",
    });

    assert.ok(parsed);
    assert.equal(parsed?.estado, "PENDIENTE_PUJAS");
  });

  it("knows immediate-cancel and terminal estados", () => {
    assert.equal(isFlipyImmediateCancelEstado("PENDIENTE_PUJAS"), true);
    assert.equal(isFlipyImmediateCancelEstado("ASIGNADO"), false);
    assert.equal(isFlipyTerminalEstado("CANCELADO"), true);
    assert.equal(isFlipyTerminalEstado("EN_CURSO"), false);
  });
});
