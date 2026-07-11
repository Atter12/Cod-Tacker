"use server";

import { revalidatePath } from "next/cache";
import { actionFail, actionOk, type ActionResult } from "@/lib/actions/action-result";
import { writeAuditLog } from "@/lib/audit/write-audit";
import { requireUser } from "@/lib/auth/require-user";
import { routes } from "@/config/routes";
import { ValidationError } from "@/lib/errors";
import type { Role } from "@/config/permissions";
import { can } from "@/lib/permissions/can";
import {
  storeSettingsUpdateSchema,
  storeSettingsToJson,
  type StoreSettingsUpdateInput,
} from "@/lib/settings/store-settings";
import { createClient } from "@/lib/supabase/server";
import { requireStoreAccess } from "@/lib/tenant/require-store-access";
import type { Json } from "@/types/database";

export type SettingsActionResult = ActionResult;

function assertStoreManage(roles: readonly Role[]) {
  if (!can(roles, "store.manage")) {
    throw new ValidationError("No tienes permiso para editar la configuración de la tienda.");
  }
}

export async function updateStoreSettings(
  agencySlug: string,
  storeSlug: string,
  raw: StoreSettingsUpdateInput,
): Promise<SettingsActionResult> {
  try {
    const parsed = storeSettingsUpdateSchema.safeParse(raw);
    if (!parsed.success) {
      throw new ValidationError(parsed.error.issues[0]?.message ?? "Datos de configuración inválidos.");
    }
    const input = parsed.data;
    if (input.settings.rto.criticalThresholdPct < input.settings.rto.highRiskThresholdPct) {
      throw new ValidationError("El umbral crítico de RTO debe ser mayor o igual al umbral alto.");
    }

    const user = await requireUser();
    const membership = await requireStoreAccess(agencySlug, storeSlug);
    assertStoreManage(membership.roles);
    if (!membership.storeId) throw new ValidationError("Tienda inválida.");

    const client = await createClient();
    const { data: before } = await client
      .from("stores")
      .select("name, country_code, currency_code, timezone, default_attribution_model, attribution_window_days, settings")
      .eq("id", membership.storeId)
      .single();

    const settingsJson = storeSettingsToJson(input.settings) as Json;
    const { error } = await client
      .from("stores")
      .update({
        name: input.name,
        country_code: input.countryCode,
        currency_code: input.currencyCode,
        timezone: input.timezone,
        default_attribution_model: input.attributionModel,
        attribution_window_days: input.attributionWindowDays,
        settings: settingsJson,
        updated_at: new Date().toISOString(),
      })
      .eq("id", membership.storeId)
      .eq("agency_id", membership.agencyId);

    if (error) throw error;

    await writeAuditLog({
      action: "store_settings_updated",
      entityType: "store",
      entityId: membership.storeId,
      actorId: user.id,
      agencyId: membership.agencyId,
      storeId: membership.storeId,
      oldData: (before ?? null) as Json,
      newData: {
        name: input.name,
        countryCode: input.countryCode,
        currencyCode: input.currencyCode,
        timezone: input.timezone,
        attributionModel: input.attributionModel,
        attributionWindowDays: input.attributionWindowDays,
        settings: settingsJson,
      },
    });

    revalidatePath(routes.store.settings(agencySlug, storeSlug));
    return actionOk();
  } catch (error) {
    return actionFail(error);
  }
}
