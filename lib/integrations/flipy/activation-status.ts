import type { FlipyTiendaProfileResult } from "@/lib/integrations/flipy/partner-contract";

export type FlipyActivationUiState = {
  /** CT UI: Flipy activationReady && email verified && no password yet. */
  activationReady: boolean;
  alreadyActivated: boolean;
  emailVerified: boolean;
  passwordSetAt: string | null;
  flipyActivationReady: boolean;
};

/** Email verified on Flipy profile (boolean flag or timestamp). */
export function isFlipyProfileEmailVerified(profile: FlipyTiendaProfileResult | null): boolean {
  if (!profile) return false;
  if (profile.emailVerified === true) return true;
  return Boolean(profile.emailVerifiedAt?.trim());
}

/**
 * Maps Partner GET tiendas/:id to CT activation UI state.
 * Flipy `activationReady` only reflects passwordSetAt; CT also requires email verified.
 */
export function resolveFlipyActivationUiState(
  profile: FlipyTiendaProfileResult | null,
  options?: { storeEmailVerified?: boolean },
): FlipyActivationUiState {
  const passwordSetAt = profile?.passwordSetAt?.trim() ?? null;
  const alreadyActivated = Boolean(passwordSetAt);
  const emailVerified =
    isFlipyProfileEmailVerified(profile) || options?.storeEmailVerified === true;
  const flipyActivationReady = profile?.activationReady === true;
  const activationReady = flipyActivationReady && emailVerified && !alreadyActivated;

  return {
    activationReady,
    alreadyActivated,
    emailVerified,
    passwordSetAt,
    flipyActivationReady,
  };
}
