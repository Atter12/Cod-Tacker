"use server";

import { revalidatePath } from "next/cache";
import { actionFail, actionOk, type ActionResult } from "@/lib/actions/action-result";
import { writeAuditLog } from "@/lib/audit/write-audit";
import { requireUser } from "@/lib/auth/require-user";
import { sendStoreContactOtpEmail } from "@/lib/email/send-store-contact-otp";
import { ValidationError } from "@/lib/errors";
import { FlipyPartnerApiError } from "@/lib/integrations/flipy/errors";
import { syncFlipyStoreContactEmailTrust } from "@/lib/integrations/flipy/sync-store-contact-email";
import { can } from "@/lib/permissions/can";
import { routes } from "@/config/routes";
import {
  buildStoreSettingsWithContactEmail,
  clearStoreContactEmailChangeRollback,
  isStoreContactEmailVerified,
  mergeStoreContactEmailIntoSettings,
  readStoreContactEmail,
  stashStoreContactEmailChangeRollback,
  validateStoreContactEmail,
} from "@/lib/settings/store-contact-email";
import {
  generateStoreContactOtpCode,
  hashStoreContactOtpCode,
  storeContactOtpExpiresAt,
  verifyStoreContactOtpHash,
} from "@/lib/store-contact-email/otp";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { requireStoreAccess } from "@/lib/tenant/require-store-access";
import type { Json } from "@/types/database";

export type StoreContactEmailActionResult = ActionResult<{
  success?: string;
  flipyPasswordSetAt?: string | null;
  emailChanged?: boolean;
}>;

const otpPattern = /^\d{6}$/;
const RESEND_COOLDOWN_MS = 1000 * 60;
const MAX_OTP_PER_HOUR = 5;

function assertStoreManage(roles: readonly string[]) {
  if (!can(roles as Parameters<typeof can>[0], "store.manage")) {
    throw new ValidationError("No tienes permiso para editar la configuración de la tienda.");
  }
}

function validateOtpToken(token: string): string {
  const value = token.trim();
  if (!otpPattern.test(value)) {
    throw new ValidationError("Ingresa el código de 6 dígitos que recibiste por correo.");
  }
  return value;
}

async function loadStoreForContactEmail(agencySlug: string, storeSlug: string) {
  const user = await requireUser();
  const membership = await requireStoreAccess(agencySlug, storeSlug);
  assertStoreManage(membership.roles);
  if (!membership.storeId) throw new ValidationError("Tienda inválida.");
  const client = await createClient();
  const { data: store, error } = await client
    .from("stores")
    .select("id, name, settings")
    .eq("id", membership.storeId)
    .eq("agency_id", membership.agencyId)
    .single();
  if (error || !store) throw new ValidationError("No se pudo cargar la tienda.");
  return { user, membership, client, store };
}

async function assertOtpRateLimit(storeId: string) {
  const admin = createAdminClient();
  const sinceHour = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const { count, error } = await admin
    .from("store_contact_email_otps")
    .select("id", { count: "exact", head: true })
    .eq("store_id", storeId)
    .gte("created_at", sinceHour);
  if (error) throw error;
  if ((count ?? 0) >= MAX_OTP_PER_HOUR) {
    throw new ValidationError("Demasiados intentos. Espera unos minutos antes de solicitar otro código.");
  }

  const sinceCooldown = new Date(Date.now() - RESEND_COOLDOWN_MS).toISOString();
  const { data: recent } = await admin
    .from("store_contact_email_otps")
    .select("id")
    .eq("store_id", storeId)
    .is("consumed_at", null)
    .gte("created_at", sinceCooldown)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (recent) {
    throw new ValidationError("Espera un minuto antes de solicitar otro código.");
  }
}

async function issueStoreContactOtp(input: {
  storeId: string;
  storeName: string;
  email: string;
  userId: string;
}) {
  await assertOtpRateLimit(input.storeId);
  const code = generateStoreContactOtpCode();
  const admin = createAdminClient();
  const expiresAt = storeContactOtpExpiresAt();
  const codeHash = hashStoreContactOtpCode({
    storeId: input.storeId,
    email: input.email,
    code,
  });

  const { error } = await admin.from("store_contact_email_otps").insert({
    store_id: input.storeId,
    email: input.email,
    code_hash: codeHash,
    expires_at: expiresAt,
    created_by: input.userId,
  });
  if (error) throw error;

  await sendStoreContactOtpEmail({
    to: input.email,
    code,
    storeName: input.storeName,
  });
}

async function persistStoreContactSettings(input: {
  client: Awaited<ReturnType<typeof createClient>>;
  agencyId: string;
  storeId: string;
  settings: Record<string, unknown>;
}) {
  const { error } = await input.client
    .from("stores")
    .update({
      settings: input.settings as Json,
      updated_at: new Date().toISOString(),
    })
    .eq("id", input.storeId)
    .eq("agency_id", input.agencyId);
  if (error) throw error;
}

export async function setStoreContactEmail(
  agencySlug: string,
  storeSlug: string,
  rawEmail: string,
): Promise<StoreContactEmailActionResult> {
  try {
    const email = validateStoreContactEmail(rawEmail);
    const { user, membership, client, store } = await loadStoreForContactEmail(agencySlug, storeSlug);
    const current = readStoreContactEmail(store.settings);
    const wasVerified = isStoreContactEmailVerified(store.settings);
    const sameVerified =
      current.contactEmail === email && isStoreContactEmailVerified(store.settings);

    if (sameVerified) {
      return actionOk({ success: "Este correo ya está verificado para la tienda." });
    }

    const baseSettings =
      store.settings && typeof store.settings === "object" && !Array.isArray(store.settings)
        ? (store.settings as Record<string, unknown>)
        : {};

    let nextSettings = buildStoreSettingsWithContactEmail(baseSettings, email);
    const emailChangedFromVerified =
      wasVerified && current.contactEmail && current.contactEmail !== email;
    if (emailChangedFromVerified) {
      nextSettings = stashStoreContactEmailChangeRollback(nextSettings, current);
    }

    await persistStoreContactSettings({
      client,
      agencyId: membership.agencyId,
      storeId: store.id,
      settings: nextSettings,
    });

    await issueStoreContactOtp({
      storeId: store.id,
      storeName: store.name,
      email,
      userId: user.id,
    });

    await writeAuditLog({
      action: emailChangedFromVerified ? "store_contact_email_change_requested" : "store_contact_email_set",
      entityType: "store",
      entityId: store.id,
      actorId: user.id,
      agencyId: membership.agencyId,
      storeId: store.id,
      oldData: emailChangedFromVerified ? { contact_email: current.contactEmail } : undefined,
      newData: { contact_email: email, verified: false },
    });

    revalidatePath(routes.store.settings(agencySlug, storeSlug));
    revalidatePath(routes.store.integrations(agencySlug, storeSlug));
    return actionOk({
      success: `Enviamos un código de 6 dígitos a ${email}. Revisa tu bandeja de entrada.`,
    });
  } catch (error) {
    return actionFail(error);
  }
}

export async function sendStoreContactEmailOtp(
  agencySlug: string,
  storeSlug: string,
): Promise<StoreContactEmailActionResult> {
  try {
    const { user, membership, store } = await loadStoreForContactEmail(agencySlug, storeSlug);
    const contact = readStoreContactEmail(store.settings);
    if (!contact.contactEmail) {
      throw new ValidationError("Primero ingresa un correo de contacto para la tienda.");
    }
    const emailChangePending = Boolean(contact.changeRollbackEmail);
    if (isStoreContactEmailVerified(store.settings) && !emailChangePending) {
      return actionOk({ success: "El correo de la tienda ya está verificado." });
    }

    await issueStoreContactOtp({
      storeId: store.id,
      storeName: store.name,
      email: contact.contactEmail,
      userId: user.id,
    });

    revalidatePath(routes.store.settings(agencySlug, storeSlug));
    return actionOk({
      success: `Te enviamos un nuevo código a ${contact.contactEmail}.`,
    });
  } catch (error) {
    return actionFail(error);
  }
}

export async function verifyStoreContactEmailOtp(
  agencySlug: string,
  storeSlug: string,
  token: string,
): Promise<StoreContactEmailActionResult> {
  try {
    const code = validateOtpToken(token);
    const { user, membership, client, store } = await loadStoreForContactEmail(agencySlug, storeSlug);
    const contact = readStoreContactEmail(store.settings);
    const emailChangePending = Boolean(contact.changeRollbackEmail);
    const rollbackEmail = contact.changeRollbackEmail;
    const rollbackVerifiedAt = contact.changeRollbackVerifiedAt;
    const rollbackVerifiedBy = contact.changeRollbackVerifiedBy;

    const admin = createAdminClient();
    const now = new Date().toISOString();
    if (!contact.contactEmail) {
      throw new ValidationError("No hay correo de contacto pendiente de verificación.");
    }
    if (isStoreContactEmailVerified(store.settings) && !emailChangePending) {
      return actionOk({ success: "El correo de la tienda ya está verificado." });
    }

    const { data: challenge, error } = await admin
      .from("store_contact_email_otps")
      .select("id, code_hash, expires_at, email")
      .eq("store_id", store.id)
      .eq("email", contact.contactEmail)
      .is("consumed_at", null)
      .gt("expires_at", now)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    if (!challenge) {
      throw new ValidationError("El código expiró o no es válido. Solicita uno nuevo.");
    }

    const valid = verifyStoreContactOtpHash({
      storeId: store.id,
      email: contact.contactEmail,
      code,
      codeHash: challenge.code_hash,
    });
    if (!valid) {
      throw new ValidationError("El código ingresado no es válido.");
    }

    await admin
      .from("store_contact_email_otps")
      .update({ consumed_at: now })
      .eq("id", challenge.id);

    const baseSettings =
      store.settings && typeof store.settings === "object" && !Array.isArray(store.settings)
        ? (store.settings as Record<string, unknown>)
        : {};
    const verifiedAt = now;
    let nextSettings = mergeStoreContactEmailIntoSettings(baseSettings, {
      contactEmail: contact.contactEmail,
      contactEmailVerifiedAt: verifiedAt,
      contactEmailVerifiedBy: user.id,
    });
    nextSettings = clearStoreContactEmailChangeRollback(nextSettings);
    await persistStoreContactSettings({
      client,
      agencyId: membership.agencyId,
      storeId: store.id,
      settings: nextSettings,
    });

    const auditAction = emailChangePending ? "store_contact_email_changed" : "store_contact_email_verified";
    await writeAuditLog({
      action: auditAction,
      entityType: "store",
      entityId: store.id,
      actorId: user.id,
      agencyId: membership.agencyId,
      storeId: store.id,
      oldData: emailChangePending ? { contact_email: contact.changeRollbackEmail } : undefined,
      newData: { contact_email: contact.contactEmail, verified_at: verifiedAt },
    });

    let flipyPasswordSetAt: string | null = null;
    try {
      const flipyProfile = await syncFlipyStoreContactEmailTrust({
        agencyId: membership.agencyId,
        storeId: store.id,
        contactEmail: contact.contactEmail,
        emailVerifiedAt: verifiedAt,
      });
      flipyPasswordSetAt = flipyProfile?.passwordSetAt ?? null;
    } catch (error) {
      if (emailChangePending && rollbackEmail) {
        const restored = mergeStoreContactEmailIntoSettings(
          clearStoreContactEmailChangeRollback(baseSettings),
          {
            contactEmail: rollbackEmail,
            contactEmailVerifiedAt: rollbackVerifiedAt,
            contactEmailVerifiedBy: rollbackVerifiedBy,
          },
        );
        await persistStoreContactSettings({
          client,
          agencyId: membership.agencyId,
          storeId: store.id,
          settings: restored,
        });
      }
      if (error instanceof FlipyPartnerApiError) throw error;
      throw error;
    }

    revalidatePath(routes.store.settings(agencySlug, storeSlug));
    revalidatePath(routes.store.integrations(agencySlug, storeSlug));
    revalidatePath(routes.store.integrationDetail(agencySlug, storeSlug, "flipy"));

    const successMessage = emailChangePending
      ? flipyPasswordSetAt
        ? `Correo actualizado a ${contact.contactEmail}. Inicia sesión en la app Flipy con el nuevo correo (misma contraseña).`
        : `Correo actualizado a ${contact.contactEmail}. Activa la app Flipy con el nuevo correo si aún no tienes contraseña.`
      : "Correo de tienda verificado. Ya puedes conectar Flipy.";

    return actionOk({
      success: successMessage,
      flipyPasswordSetAt,
      emailChanged: emailChangePending,
    });
  } catch (error) {
    return actionFail(error);
  }
}
