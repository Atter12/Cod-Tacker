import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { toUserMessage } from "./to-user-message";
import { AppError } from "./AppError";
import { ValidationError } from "./ValidationError";

describe("toUserMessage", () => {
  it("returns AppError safeMessage", () => {
    assert.equal(toUserMessage(new ValidationError("Campo requerido.")), "Campo requerido.");
    assert.equal(toUserMessage(new AppError("X", 500, "Mensaje seguro")), "Mensaje seguro");
  });

  it("maps common auth failures", () => {
    assert.equal(
      toUserMessage({ message: "Invalid login credentials" }),
      "Correo o contraseña incorrectos.",
    );
  });

  it("does not leak postgres / rls details", () => {
    const msg = toUserMessage({
      code: "42501",
      message: "permission denied for table agencies",
    });
    assert.equal(msg, "No se pudo completar la operación. Inténtalo nuevamente.");
  });

  it("maps unique violations safely", () => {
    assert.equal(
      toUserMessage({ code: "23505", message: "duplicate key value violates unique constraint" }),
      "Ya existe un registro con esos datos.",
    );
  });
});
