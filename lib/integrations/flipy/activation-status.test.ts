import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  isFlipyProfileEmailVerified,
  resolveFlipyActivationUiState,
} from "@/lib/integrations/flipy/activation-status";
import type { FlipyTiendaProfileResult } from "@/lib/integrations/flipy/partner-contract";

function profile(overrides: Partial<FlipyTiendaProfileResult> = {}): FlipyTiendaProfileResult {
  return {
    tiendaId: "tienda-1",
    contactEmail: "ops@tienda.pe",
    nombre: "Tienda",
    externalStoreId: "store-uuid",
    emailVerified: null,
    emailVerifiedAt: null,
    passwordSetAt: null,
    activationReady: null,
    ...overrides,
  };
}

describe("flipy activation UI state", () => {
  it("requires email verified for CT activationReady", () => {
    const state = resolveFlipyActivationUiState(
      profile({ activationReady: true, emailVerified: false, emailVerifiedAt: null }),
    );
    assert.equal(state.flipyActivationReady, true);
    assert.equal(state.emailVerified, false);
    assert.equal(state.activationReady, false);
  });

  it("activationReady when flipy ready, email verified, no password", () => {
    const state = resolveFlipyActivationUiState(
      profile({
        activationReady: true,
        emailVerified: true,
        emailVerifiedAt: "2026-08-27T12:00:00.000Z",
      }),
    );
    assert.equal(state.activationReady, true);
    assert.equal(state.alreadyActivated, false);
    assert.equal(state.emailVerified, true);
  });

  it("not activationReady when password already set", () => {
    const state = resolveFlipyActivationUiState(
      profile({
        activationReady: false,
        emailVerified: true,
        passwordSetAt: "2026-08-27T13:00:00.000Z",
      }),
    );
    assert.equal(state.alreadyActivated, true);
    assert.equal(state.activationReady, false);
  });

  it("falls back to CT store email verified flag", () => {
    const state = resolveFlipyActivationUiState(
      profile({ activationReady: true, emailVerified: null, emailVerifiedAt: null }),
      { storeEmailVerified: true },
    );
    assert.equal(state.emailVerified, true);
    assert.equal(state.activationReady, true);
  });

  it("detects email verified from timestamp", () => {
    assert.equal(
      isFlipyProfileEmailVerified(profile({ emailVerifiedAt: "2026-08-27T12:00:00.000Z" })),
      true,
    );
    assert.equal(isFlipyProfileEmailVerified(profile({ emailVerified: true })), true);
    assert.equal(isFlipyProfileEmailVerified(profile()), false);
  });
});
