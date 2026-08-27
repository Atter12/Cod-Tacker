"use server";

import { actionFail, actionOk, type ActionResult } from "@/lib/actions/action-result";
import { IntegrationError, ValidationError } from "@/lib/errors";
import { readFlipyTiendaId } from "@/lib/integrations/flipy/credentials";
import { createFlipyPartnerClient } from "@/lib/integrations/flipy/client";
import {
  buildFlipyAppActivationUrl,
  buildFlipyAppLoginUrl,
} from "@/lib/integrations/flipy/embed-urls";
import { resolveFlipyActivationUiState } from "@/lib/integrations/flipy/activation-status";
import { FlipyPartnerApiError } from "@/lib/integrations/flipy/errors";
import { getFlipyEnv } from "@/lib/integrations/flipy/env";
import { buildStorePartnerEmailTrust } from "@/lib/integrations/flipy/partner-trust";
import { resolveFlipyIntegrationForStore } from "@/lib/integrations/flipy/webhook-ingress";
import { getIntegrationRuntimeMode } from "@/lib/integrations/registry";
import {
  isStoreContactEmailVerified,
  readStoreContactEmail,
} from "@/lib/settings/store-contact-email";
import { can } from "@/lib/permissions/can";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { requireStoreAccess } from "@/lib/tenant/require-store-access";
import { requireUser } from "@/lib/auth/require-user";
import { toUserMessage } from "@/lib/errors/to-user-message";

export type FlipyActivationUrlResult = {
  activationUrl: string;
  alreadyActivated?: boolean;
  loginUrl?: string;
};

export type FlipyActivationStatusResult = {
  activationReady: boolean;
  alreadyActivated: boolean;
  emailVerified: boolean;
  passwordSetAt: string | null;
  contactEmail: string | null;
};

export async function getFlipyActivationStatusAction(input: {
  agencySlug: string;
  storeSlug: string;
}): Promise<ActionResult<FlipyActivationStatusResult>> {
  try {
    if (getIntegrationRuntimeMode() !== "live") {
      return actionOk({
        activationReady: false,
        alreadyActivated: false,
        emailVerified: false,
        passwordSetAt: null,
        contactEmail: null,
      });
    }

    await requireUser();
    const membership = await requireStoreAccess(input.agencySlug, input.storeSlug);
    if (!membership.storeId) throw new ValidationError("Tienda inválida.");

    const client = await createClient();
    const { data: storeRow } = await client
      .from("stores")
      .select("settings")
      .eq("id", membership.storeId)
      .single();
    const storeContact = readStoreContactEmail(storeRow?.settings);
    const storeEmailVerified = isStoreContactEmailVerified(storeRow?.settings);

    const admin = createAdminClient();
    const integration = await resolveFlipyIntegrationForStore(
      admin,
      membership.agencyId,
      membership.storeId,
    );
    if (!integration || integration.status === "disconnected") {
      return actionOk({
        activationReady: false,
        alreadyActivated: false,
        emailVerified: storeEmailVerified,
        passwordSetAt: null,
        contactEmail: storeContact.contactEmail,
      });
    }

    const flipyTiendaId =
      readFlipyTiendaId(integration.settings) ?? integration.external_account_id?.trim() ?? null;
    if (!flipyTiendaId) {
      return actionOk({
        activationReady: false,
        alreadyActivated: false,
        emailVerified: storeEmailVerified,
        passwordSetAt: null,
        contactEmail: storeContact.contactEmail,
      });
    }

    const env = getFlipyEnv();
    if (!env.partnerApiKey) {
      return actionOk({
        activationReady: false,
        alreadyActivated: false,
        emailVerified: storeEmailVerified,
        passwordSetAt: null,
        contactEmail: storeContact.contactEmail,
      });
    }

    const flipyClient = createFlipyPartnerClient({
      baseUrl: env.apiBaseUrl,
      partnerKey: env.partnerApiKey,
      partnerId: env.partnerId,
      externalStoreId: membership.storeId,
    });

    const profile = await flipyClient.getTiendaProfile(flipyTiendaId);
    const uiState = resolveFlipyActivationUiState(profile, {
      storeEmailVerified: storeEmailVerified,
    });

    return actionOk({
      activationReady: uiState.activationReady,
      alreadyActivated: uiState.alreadyActivated,
      emailVerified: uiState.emailVerified,
      passwordSetAt: uiState.passwordSetAt,
      contactEmail: profile?.contactEmail ?? storeContact.contactEmail,
    });
  } catch (error) {
    return actionFail(error);
  }
}

export async function issueFlipyActivationUrlAction(input: {
  agencySlug: string;
  storeSlug: string;
  contactEmail: string;
}): Promise<ActionResult<FlipyActivationUrlResult>> {
  try {
    if (getIntegrationRuntimeMode() !== "live") {
      throw new ValidationError("Activación Flipy requiere INTEGRATION_MODE=live.");
    }

    await requireUser();
    const membership = await requireStoreAccess(input.agencySlug, input.storeSlug);
    if (!can(membership.roles, "integrations.view")) {
      throw new ValidationError("No tienes permiso para activar la cuenta Flipy.");
    }
    if (!membership.storeId) throw new ValidationError("Tienda inválida.");

    const client = await createClient();
    const { data: storeRow } = await client
      .from("stores")
      .select("settings")
      .eq("id", membership.storeId)
      .single();
    const storeContact = readStoreContactEmail(storeRow?.settings);
    if (!isStoreContactEmailVerified(storeRow?.settings)) {
      throw new ValidationError(
        "Verifica el correo operativo de la tienda en Configuración antes de activar Flipy.",
      );
    }

    const contactEmail = (storeContact.contactEmail ?? input.contactEmail).trim();
    if (!contactEmail) {
      throw new ValidationError("Correo de contacto requerido para activar Flipy.");
    }

    const admin = createAdminClient();
    const integration = await resolveFlipyIntegrationForStore(
      admin,
      membership.agencyId,
      membership.storeId,
    );
    if (!integration || integration.status === "disconnected") {
      throw new IntegrationError("Conecta Flipy en Integraciones antes de activar la cuenta.");
    }

    const flipyTiendaId =
      readFlipyTiendaId(integration.settings) ?? integration.external_account_id?.trim() ?? null;
    if (!flipyTiendaId) {
      throw new IntegrationError(
        "Integración Flipy sin tiendaId. Usa «Conectar Flipy» para provisionar la tienda en Flipy.",
      );
    }

    const env = getFlipyEnv();
    const loginUrl = buildFlipyAppLoginUrl({ appOrigin: env.appOrigin, contactEmail });

    const trust = buildStorePartnerEmailTrust({
      externalStoreId: membership.storeId,
      email: contactEmail,
      emailVerifiedAt: storeContact.contactEmailVerifiedAt,
    });
    if (!trust) {
      throw new IntegrationError(
        "PARTNER_EMAIL_ASSERTION_SECRET no configurada. Añádela en Vercel (debe coincidir con Flipy v0.2.1).",
      );
    }

    const flipyClient = createFlipyPartnerClient({
      baseUrl: env.apiBaseUrl,
      partnerKey: env.partnerApiKey!,
      partnerId: env.partnerId,
      externalStoreId: membership.storeId,
    });

    try {
      const init = await flipyClient.initActivateAccount({
        contactEmail,
        flipyTiendaId,
        externalStoreId: membership.storeId,
        emailVerified: true,
        partnerEmailAssertion: trust.partnerEmailAssertion,
      });

      if (init.otpRequired === true) {
        throw new IntegrationError(
          "Flipy solicitó OTP en activación (v0.2.1 espera otpRequired: false). Contacta soporte.",
        );
      }

      const activationUrlFromApi = init.activationUrl?.trim();
      const activationUrl = activationUrlFromApi
        ? activationUrlFromApi
        : buildFlipyAppActivationUrl({
            appOrigin: env.appOrigin,
            contactEmail,
            activationPath: env.appActivationPath,
            flipyTiendaId,
            externalStoreId: membership.storeId,
            partnerEmailAssertion: trust.partnerEmailAssertion,
            emailVerified: true,
            token: init.token,
          });

      return actionOk({ activationUrl, loginUrl });
    } catch (error) {
      if (error instanceof FlipyPartnerApiError && error.code === "ALREADY_ACTIVATED") {
        return actionOk({ activationUrl: loginUrl, alreadyActivated: true, loginUrl });
      }
      if (error instanceof FlipyPartnerApiError && error.status === 409) {
        return actionOk({ activationUrl: loginUrl, alreadyActivated: true, loginUrl });
      }
      throw error;
    }
  } catch (error) {
    return { error: toUserMessage(error) };
  }
}
