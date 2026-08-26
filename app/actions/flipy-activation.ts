"use server";

import { actionOk, type ActionResult } from "@/lib/actions/action-result";
import { IntegrationError, ValidationError } from "@/lib/errors";
import { createFlipyPartnerClient } from "@/lib/integrations/flipy/client";
import {
  readFlipyTiendaId,
  resolveFlipyPartnerKeyFromIntegration,
} from "@/lib/integrations/flipy/credentials";
import { buildFlipyAppActivationUrl } from "@/lib/integrations/flipy/embed-urls";
import { getFlipyEnv } from "@/lib/integrations/flipy/env";
import { resolveFlipyIntegrationForStore } from "@/lib/integrations/flipy/webhook-ingress";
import { getIntegrationRuntimeMode } from "@/lib/integrations/registry";
import { can } from "@/lib/permissions/can";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireStoreAccess } from "@/lib/tenant/require-store-access";
import { requireUser } from "@/lib/auth/require-user";
import { toUserMessage } from "@/lib/errors/to-user-message";

export type FlipyActivationUrlResult = {
  activationUrl: string;
};

export async function issueFlipyActivationUrlAction(input: {
  agencySlug: string;
  storeSlug: string;
  contactEmail: string;
}): Promise<ActionResult<FlipyActivationUrlResult>> {
  try {
    if (getIntegrationRuntimeMode() !== "live") {
      throw new ValidationError("Activación Flipy requiere INTEGRATION_MODE=live.");
    }

    const contactEmail = input.contactEmail.trim();
    if (!contactEmail) {
      throw new ValidationError("Correo de contacto requerido para activar Flipy.");
    }

    await requireUser();
    const membership = await requireStoreAccess(input.agencySlug, input.storeSlug);
    if (!can(membership.roles, "integrations.view")) {
      throw new ValidationError("No tienes permiso para activar la cuenta Flipy.");
    }
    if (!membership.storeId) throw new ValidationError("Tienda inválida.");

    const admin = createAdminClient();
    const integration = await resolveFlipyIntegrationForStore(
      admin,
      membership.agencyId,
      membership.storeId,
    );
    if (!integration || integration.status === "disconnected") {
      throw new IntegrationError("Conecta Flipy en Integraciones antes de activar la cuenta.");
    }

    const partnerKey = resolveFlipyPartnerKeyFromIntegration(integration);
    if (!partnerKey) {
      throw new IntegrationError("FLIPY_PARTNER_API_KEY no configurada.");
    }

    const flipyTiendaId = readFlipyTiendaId(integration.settings) ?? integration.external_account_id;
    const env = getFlipyEnv();
    const client = createFlipyPartnerClient({
      baseUrl: env.apiBaseUrl,
      partnerKey,
      partnerId: env.partnerId,
      externalStoreId: membership.storeId,
    });

    const session = await client.initActivateAccount({ contactEmail });
    const activationUrl =
      session.activationUrl?.trim() ||
      buildFlipyAppActivationUrl({
        appOrigin: env.appOrigin,
        contactEmail,
        activationPath: env.appActivationPath,
        externalStoreId: membership.storeId,
        flipyTiendaId,
        token: session.token,
      });

    return actionOk({ activationUrl });
  } catch (error) {
    return { error: toUserMessage(error) };
  }
}
