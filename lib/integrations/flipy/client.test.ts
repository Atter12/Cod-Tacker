import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildFlipyProvisionRequestBody,
  readFlipySaldoOperaciones,
  readFlipySaldoReservado,
} from "@/lib/integrations/flipy/partner-contract";

describe("flipy partner contract", () => {
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
