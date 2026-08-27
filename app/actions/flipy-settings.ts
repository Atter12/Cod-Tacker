"use server";

import { revalidatePath } from "next/cache";
import { routes } from "@/config/routes";
import { actionFail, actionOk, type ActionResult } from "@/lib/actions/action-result";
import { IntegrationError, ValidationError } from "@/lib/errors";
import {
  mergeFlipyAutoCreateSettings,
  mergeFlipyEmbedBidsEvalSettings,
  mergeFlipyPickupKeywords,
  normalizePickupKeywordInput,
  readFlipyAutoCreateEnabled,
  readFlipyAutoCreateMinConfidence,
  readFlipyEmbedBidsEvalEnabled,
  readFlipyPickupKeywords,
  type FlipyAutoCreateMinConfidence,
} from "@/lib/integrations/flipy/settings";
import { resolveFlipyIntegrationForStore } from "@/lib/integrations/flipy/webhook-ingress";
import { can } from "@/lib/permissions/can";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireStoreAccess } from "@/lib/tenant/require-store-access";
import { requireUser } from "@/lib/auth/require-user";
import type { Json } from "@/types/database.generated";

export async function updateFlipyPickupKeywordsAction(input: {
  agencySlug: string;
  storeSlug: string;
  keywordsText: string;
}): Promise<ActionResult<{ keywords: string[] }>> {
  try {
    await requireUser();
    const membership = await requireStoreAccess(input.agencySlug, input.storeSlug);
    if (!can(membership.roles, "integrations.manage")) {
      throw new ValidationError("No tienes permiso para editar integraciones.");
    }
    if (!membership.storeId) throw new ValidationError("Tienda inválida.");

    const admin = createAdminClient();
    const integration = await resolveFlipyIntegrationForStore(
      admin,
      membership.agencyId,
      membership.storeId,
    );
    if (!integration || integration.status === "disconnected") {
      throw new IntegrationError("Conecta Flipy antes de editar reglas de recojo.");
    }

    const keywords = normalizePickupKeywordInput(input.keywordsText);
    const nextSettings = mergeFlipyPickupKeywords(integration.settings, keywords);

    const updated = await admin
      .from("integrations")
      .update({
        settings: nextSettings as Json,
        updated_at: new Date().toISOString(),
      })
      .eq("id", integration.id)
      .eq("store_id", membership.storeId)
      .select("settings")
      .maybeSingle();

    if (updated.error || !updated.data) {
      throw new ValidationError("No se pudieron guardar las reglas de recojo.");
    }

    revalidatePath(routes.store.integrationDetail(input.agencySlug, input.storeSlug, "flipy"));
    return actionOk({ keywords: readFlipyPickupKeywords(updated.data.settings) });
  } catch (error) {
    return actionFail(error);
  }
}

export async function updateFlipyAutoCreateSettingsAction(input: {
  agencySlug: string;
  storeSlug: string;
  enabled: boolean;
  minConfidence: FlipyAutoCreateMinConfidence;
}): Promise<ActionResult<{ enabled: boolean; minConfidence: FlipyAutoCreateMinConfidence }>> {
  try {
    await requireUser();
    const membership = await requireStoreAccess(input.agencySlug, input.storeSlug);
    if (!can(membership.roles, "integrations.manage")) {
      throw new ValidationError("No tienes permiso para editar integraciones.");
    }
    if (!membership.storeId) throw new ValidationError("Tienda inválida.");

    const admin = createAdminClient();
    const integration = await resolveFlipyIntegrationForStore(
      admin,
      membership.agencyId,
      membership.storeId,
    );
    if (!integration || integration.status === "disconnected") {
      throw new IntegrationError("Conecta Flipy antes de editar auto-create.");
    }

    const nextSettings = mergeFlipyAutoCreateSettings(integration.settings, {
      enabled: input.enabled,
      minConfidence: input.minConfidence,
    });

    const updated = await admin
      .from("integrations")
      .update({
        settings: nextSettings as Json,
        updated_at: new Date().toISOString(),
      })
      .eq("id", integration.id)
      .eq("store_id", membership.storeId)
      .select("settings")
      .maybeSingle();

    if (updated.error || !updated.data) {
      throw new ValidationError("No se pudieron guardar las reglas de auto-create.");
    }

    revalidatePath(routes.store.integrationDetail(input.agencySlug, input.storeSlug, "flipy"));
    return actionOk({
      enabled: readFlipyAutoCreateEnabled(updated.data.settings),
      minConfidence: readFlipyAutoCreateMinConfidence(updated.data.settings),
    });
  } catch (error) {
    return actionFail(error);
  }
}

export async function updateFlipyEmbedBidsEvalAction(input: {
  agencySlug: string;
  storeSlug: string;
  enabled: boolean;
}): Promise<ActionResult<{ enabled: boolean }>> {
  try {
    await requireUser();
    const membership = await requireStoreAccess(input.agencySlug, input.storeSlug);
    if (!can(membership.roles, "integrations.manage")) {
      throw new ValidationError("No tienes permiso para editar integraciones.");
    }
    if (!membership.storeId) throw new ValidationError("Tienda inválida.");

    const admin = createAdminClient();
    const integration = await resolveFlipyIntegrationForStore(
      admin,
      membership.agencyId,
      membership.storeId,
    );
    if (!integration || integration.status === "disconnected") {
      throw new IntegrationError("Conecta Flipy antes de editar embed de pujas.");
    }

    const nextSettings = mergeFlipyEmbedBidsEvalSettings(integration.settings, input.enabled);

    const updated = await admin
      .from("integrations")
      .update({
        settings: nextSettings as Json,
        updated_at: new Date().toISOString(),
      })
      .eq("id", integration.id)
      .eq("store_id", membership.storeId)
      .select("settings")
      .maybeSingle();

    if (updated.error || !updated.data) {
      throw new ValidationError("No se pudo guardar la preferencia de embed pujas.");
    }

    revalidatePath(routes.store.integrationDetail(input.agencySlug, input.storeSlug, "flipy"));
    return actionOk({ enabled: readFlipyEmbedBidsEvalEnabled(updated.data.settings) });
  } catch (error) {
    return actionFail(error);
  }
}

