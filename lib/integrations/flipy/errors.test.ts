import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  FLIPY_ERROR_CODES,
  flipyErrorUserHint,
  FlipyPartnerApiError,
} from "@/lib/integrations/flipy/errors";

describe("flipy error user hints", () => {
  it("maps ASSERTION_* codes to partner trust hint", () => {
    const hint = flipyErrorUserHint("ASSERTION_INVALID_SIGNATURE");
    assert.ok(hint);
    assert.match(hint!, /PARTNER_EMAIL_ASSERTION_SECRET/i);
  });

  it("maps partner activation and forbidden codes", () => {
    assert.match(
      flipyErrorUserHint(FLIPY_ERROR_CODES.ALREADY_ACTIVATED) ?? "",
      /contraseña Flipy/i,
    );
    assert.match(
      flipyErrorUserHint(FLIPY_ERROR_CODES.PARTNER_FORBIDDEN) ?? "",
      /vinculada/i,
    );
    assert.match(
      flipyErrorUserHint(FLIPY_ERROR_CODES.EMAIL_IN_USE) ?? "",
      /otra cuenta Flipy/i,
    );
  });

  it("maps CANCEL_BLOQUEADA_ASIGNADO to liberar / soporte (not cancela en Flipy)", () => {
    const hint = flipyErrorUserHint(FLIPY_ERROR_CODES.CANCEL_BLOQUEADA_ASIGNADO) ?? "";
    assert.match(hint, /Libéralo|liberar|soporte/i);
    assert.equal(/cancela desde Flipy/i.test(hint), false);
  });
});
