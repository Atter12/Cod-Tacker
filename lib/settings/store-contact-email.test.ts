import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildStoreSettingsWithContactEmail,
  clearStoreContactEmailChangeRollback,
  isStoreContactEmailVerified,
  mergeStoreContactEmailIntoSettings,
  readStoreContactEmail,
  restoreStoreContactEmailFromChangeRollback,
  stashStoreContactEmailChangeRollback,
  validateStoreContactEmail,
} from "@/lib/settings/store-contact-email";
import {
  generateStoreContactOtpCode,
  hashStoreContactOtpCode,
  verifyStoreContactOtpHash,
} from "@/lib/store-contact-email/otp";
import { parseStoreSettings } from "@/lib/settings/store-settings";

describe("store contact email", () => {
  it("reads and verifies contact email state from settings json", () => {
    const raw = {
      contact_email: "Ops@Tienda.pe",
      contact_email_verified_at: "2026-08-27T12:00:00.000Z",
      contact_email_verified_by: "11111111-1111-4111-8111-111111111111",
    };
    const state = readStoreContactEmail(raw);
    assert.equal(state.contactEmail, "ops@tienda.pe");
    assert.equal(isStoreContactEmailVerified(raw), true);
  });

  it("builds unverified settings on create", () => {
    const settings = buildStoreSettingsWithContactEmail({}, "ops@tienda.pe");
    assert.equal(settings.contact_email, "ops@tienda.pe");
    assert.equal(settings.contact_email_verified_at, undefined);
    assert.equal(isStoreContactEmailVerified(settings), false);
  });

  it("merges verification patch", () => {
    const base = buildStoreSettingsWithContactEmail({}, "ops@tienda.pe");
    const merged = mergeStoreContactEmailIntoSettings(base, {
      contactEmailVerifiedAt: "2026-08-27T12:00:00.000Z",
      contactEmailVerifiedBy: "11111111-1111-4111-8111-111111111111",
    });
    assert.equal(isStoreContactEmailVerified(merged), true);
  });

  it("parses contact fields via store settings schema", () => {
    const settings = parseStoreSettings({
      contact_email: "ops@tienda.pe",
      contact_email_verified_at: "2026-08-27T12:00:00.000Z",
    });
    assert.equal(settings.contact_email, "ops@tienda.pe");
  });

  it("validates email format", () => {
    assert.throws(() => validateStoreContactEmail("not-an-email"), /correo/);
    assert.equal(validateStoreContactEmail("  Ops@Tienda.PE "), "ops@tienda.pe");
  });

  it("stashes and restores email change rollback (E4)", () => {
    const verified = {
      contactEmail: "old@tienda.pe",
      contactEmailVerifiedAt: "2026-08-27T10:00:00.000Z",
      contactEmailVerifiedBy: "11111111-1111-4111-8111-111111111111",
      changeRollbackEmail: null,
      changeRollbackVerifiedAt: null,
      changeRollbackVerifiedBy: null,
    };
    let settings = buildStoreSettingsWithContactEmail({}, "new@tienda.pe");
    settings = stashStoreContactEmailChangeRollback(settings, verified);
    const pending = readStoreContactEmail(settings);
    assert.equal(pending.changeRollbackEmail, "old@tienda.pe");
    assert.equal(pending.contactEmail, "new@tienda.pe");
    assert.equal(isStoreContactEmailVerified(settings), false);

    const restored = restoreStoreContactEmailFromChangeRollback(settings);
    assert.ok(restored);
    assert.equal(readStoreContactEmail(restored).contactEmail, "old@tienda.pe");
    assert.equal(isStoreContactEmailVerified(restored), true);
    assert.equal(
      clearStoreContactEmailChangeRollback(settings).contact_email_change_previous,
      undefined,
    );
  });
});

describe("store contact otp", () => {
  it("hashes and verifies otp codes", () => {
    const code = generateStoreContactOtpCode();
    assert.match(code, /^\d{6}$/);
    const hash = hashStoreContactOtpCode({
      storeId: "store-1",
      email: "ops@tienda.pe",
      code,
    });
    assert.equal(
      verifyStoreContactOtpHash({
        storeId: "store-1",
        email: "ops@tienda.pe",
        code,
        codeHash: hash,
      }),
      true,
    );
    assert.equal(
      verifyStoreContactOtpHash({
        storeId: "store-1",
        email: "ops@tienda.pe",
        code: "000000",
        codeHash: hash,
      }),
      false,
    );
  });
});
