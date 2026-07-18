import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  conversionOutcome,
  friendlyConversionError,
  labelConversionOutcome,
  readConversionMode,
} from "./labels";

describe("conversion labels", () => {
  it("detects dry_run from custom_data.mode", () => {
    assert.equal(
      readConversionMode({ custom_data: { mode: "dry_run" }, response_payload: null }),
      "dry_run",
    );
    assert.equal(
      conversionOutcome({
        status: "sent",
        custom_data: { mode: "dry_run" },
        response_payload: null,
      }),
      "dry_run",
    );
    assert.equal(labelConversionOutcome("dry_run"), "Prueba");
  });

  it("maps live send and failure", () => {
    assert.equal(
      conversionOutcome({ status: "acknowledged", custom_data: {}, response_payload: { mode: "live" } }),
      "sent",
    );
    assert.equal(
      conversionOutcome({ status: "failed", custom_data: {}, response_payload: null }),
      "failed",
    );
  });

  it("softens technical pixel / http errors", () => {
    assert.equal(
      friendlyConversionError("Meta pixel not found"),
      "No encontramos el píxel o el conjunto de datos configurado. Revisá la configuración de la tienda.",
    );
    assert.equal(
      friendlyConversionError("Invalid event payload 400"),
      "Los datos del evento fueron rechazados. Revisá el pedido o la configuración de conversiones.",
    );
    assert.equal(
      friendlyConversionError("token expired unauthorized 401"),
      "La conexión con la plataforma de anuncios no es válida o expiró. Revisá Integraciones.",
    );
  });
});
