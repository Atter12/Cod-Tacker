"use server";

import { actionOk, type ActionResult } from "@/lib/actions/action-result";
import { IntegrationError, ValidationError } from "@/lib/errors";
import { readFlipyTiendaId } from "@/lib/integrations/flipy/credentials";
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

    const flipyTiendaId =
      readFlipyTiendaId(integration.settings) ?? integration.external_account_id?.trim() ?? null;
    if (!flipyTiendaId) {
      throw new IntegrationError(
        "Integración Flipy sin tiendaId. Usa «Conectar Flipy» para provisionar la tienda en Flipy.",
      );
    }

    const env = getFlipyEnv();
    const activationUrl = buildFlipyAppActivationUrl({
      appOrigin: env.appOrigin,
      contactEmail,
      activationPath: env.appActivationPath,
      flipyTiendaId,
    });

    return actionOk({ activationUrl });
  } catch (error) {
    return { error: toUserMessage(error) };
  }
}
