import { z } from "zod";
import { ValidationError } from "@/lib/errors";
import type { StoreSettings } from "@/lib/settings/store-settings";

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function normalizeStoreContactEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function validateStoreContactEmail(email: string): string {
  const value = normalizeStoreContactEmail(email);
  if (!emailPattern.test(value)) {
    throw new ValidationError("Ingresa un correo de contacto válido.");
  }
  return value;
}

export type StoreContactEmailState = {
  contactEmail: string | null;
  contactEmailVerifiedAt: string | null;
  contactEmailVerifiedBy: string | null;
  /** Stashed while changing email from a previously verified address (E4 rollback). */
  changeRollbackEmail: string | null;
  changeRollbackVerifiedAt: string | null;
  changeRollbackVerifiedBy: string | null;
};

function settingsBag(raw: unknown): Record<string, unknown> {
  return raw && typeof raw === "object" && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
}

export function readStoreContactEmail(raw: unknown): StoreContactEmailState {
  const bag = settingsBag(raw);
  const emailRaw = bag.contact_email;
  const verifiedAtRaw = bag.contact_email_verified_at;
  const verifiedByRaw = bag.contact_email_verified_by;
  const rollbackEmailRaw = bag.contact_email_change_previous;
  const rollbackVerifiedAtRaw = bag.contact_email_change_previous_verified_at;
  const rollbackVerifiedByRaw = bag.contact_email_change_previous_verified_by;

  return {
    contactEmail: typeof emailRaw === "string" && emailRaw.trim() ? normalizeStoreContactEmail(emailRaw) : null,
    contactEmailVerifiedAt:
      typeof verifiedAtRaw === "string" && verifiedAtRaw.trim() ? verifiedAtRaw : null,
    contactEmailVerifiedBy:
      typeof verifiedByRaw === "string" && verifiedByRaw.trim() ? verifiedByRaw : null,
    changeRollbackEmail:
      typeof rollbackEmailRaw === "string" && rollbackEmailRaw.trim()
        ? normalizeStoreContactEmail(rollbackEmailRaw)
        : null,
    changeRollbackVerifiedAt:
      typeof rollbackVerifiedAtRaw === "string" && rollbackVerifiedAtRaw.trim()
        ? rollbackVerifiedAtRaw
        : null,
    changeRollbackVerifiedBy:
      typeof rollbackVerifiedByRaw === "string" && rollbackVerifiedByRaw.trim()
        ? rollbackVerifiedByRaw
        : null,
  };
}

export function isStoreContactEmailVerified(raw: unknown): boolean {
  const state = readStoreContactEmail(raw);
  return Boolean(state.contactEmail && state.contactEmailVerifiedAt);
}

export function mergeStoreContactEmailIntoSettings(
  settings: Record<string, unknown>,
  patch: {
    contactEmail?: string | null;
    contactEmailVerifiedAt?: string | null;
    contactEmailVerifiedBy?: string | null;
  },
): Record<string, unknown> {
  const next = { ...settings };
  if (patch.contactEmail !== undefined) {
    if (patch.contactEmail) next.contact_email = normalizeStoreContactEmail(patch.contactEmail);
    else delete next.contact_email;
  }
  if (patch.contactEmailVerifiedAt !== undefined) {
    if (patch.contactEmailVerifiedAt) next.contact_email_verified_at = patch.contactEmailVerifiedAt;
    else delete next.contact_email_verified_at;
  }
  if (patch.contactEmailVerifiedBy !== undefined) {
    if (patch.contactEmailVerifiedBy) next.contact_email_verified_by = patch.contactEmailVerifiedBy;
    else delete next.contact_email_verified_by;
  }
  return next;
}

const CHANGE_ROLLBACK_KEYS = [
  "contact_email_change_previous",
  "contact_email_change_previous_verified_at",
  "contact_email_change_previous_verified_by",
] as const;

export function clearStoreContactEmailChangeRollback(
  settings: Record<string, unknown>,
): Record<string, unknown> {
  const next = { ...settings };
  for (const key of CHANGE_ROLLBACK_KEYS) delete next[key];
  return next;
}

/** Stash previous verified email when starting E4 change flow. */
export function stashStoreContactEmailChangeRollback(
  settings: Record<string, unknown>,
  previous: StoreContactEmailState,
): Record<string, unknown> {
  const next = { ...settings };
  if (previous.contactEmail) next.contact_email_change_previous = previous.contactEmail;
  if (previous.contactEmailVerifiedAt) {
    next.contact_email_change_previous_verified_at = previous.contactEmailVerifiedAt;
  }
  if (previous.contactEmailVerifiedBy) {
    next.contact_email_change_previous_verified_by = previous.contactEmailVerifiedBy;
  }
  return next;
}

export function restoreStoreContactEmailFromChangeRollback(
  settings: Record<string, unknown>,
): Record<string, unknown> | null {
  const state = readStoreContactEmail(settings);
  if (!state.changeRollbackEmail) return null;
  const next = clearStoreContactEmailChangeRollback(settings);
  return mergeStoreContactEmailIntoSettings(next, {
    contactEmail: state.changeRollbackEmail,
    contactEmailVerifiedAt: state.changeRollbackVerifiedAt,
    contactEmailVerifiedBy: state.changeRollbackVerifiedBy,
  });
}

export function buildStoreSettingsWithContactEmail(
  baseSettings: Record<string, unknown>,
  contactEmail: string,
): Record<string, unknown> {
  return mergeStoreContactEmailIntoSettings(baseSettings, {
    contactEmail,
    contactEmailVerifiedAt: null,
    contactEmailVerifiedBy: null,
  });
}

/** Zod fields merged into storeSettingsSchema for contact email persistence. */
export const storeContactEmailFieldsSchema = z.object({
  contact_email: z.string().email().optional(),
  contact_email_verified_at: z.string().optional().nullable(),
  contact_email_verified_by: z.string().uuid().optional().nullable(),
});

export type StoreContactEmailFields = z.infer<typeof storeContactEmailFieldsSchema>;

export function preserveStoreContactEmailFields(
  incoming: StoreSettings,
  existingRaw: unknown,
): StoreSettings {
  const existing = readStoreContactEmail(existingRaw);
  return {
    ...incoming,
    contact_email: incoming.contact_email ?? existing.contactEmail ?? undefined,
    contact_email_verified_at:
      incoming.contact_email_verified_at ?? existing.contactEmailVerifiedAt ?? undefined,
    contact_email_verified_by:
      incoming.contact_email_verified_by ?? existing.contactEmailVerifiedBy ?? undefined,
  };
}
