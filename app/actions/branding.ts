"use server";

import { revalidatePath } from "next/cache";
import { actionFail, actionOk, type ActionResult } from "@/lib/actions/action-result";
import { writeAuditLog } from "@/lib/audit/write-audit";
import { requireUser } from "@/lib/auth/require-user";
import { routes } from "@/config/routes";
import { ValidationError } from "@/lib/errors";
import type { Role } from "@/config/permissions";
import { can } from "@/lib/permissions/can";
import { BRANDING_DEFAULTS, brandingUpdateSchema, type BrandingUpdateInput } from "@/lib/branding/schema";
import { getAgencyPlanLimits, planAllowsWhiteLabel } from "@/lib/billing/limits";
import { createClient } from "@/lib/supabase/server";
import { requireAgencyAccess } from "@/lib/tenant/require-agency-access";
import type { Json } from "@/types/database";

export type BrandingActionResult = ActionResult;

function assertBrandingManage(roles: readonly Role[]) {
  if (!can(roles, "branding.manage")) {
    throw new ValidationError("No tienes permiso para gestionar la marca.");
  }
}

export async function updateAgencyBranding(
  agencySlug: string,
  raw: BrandingUpdateInput,
): Promise<BrandingActionResult> {
  try {
    const parsed = brandingUpdateSchema.safeParse(raw);
    if (!parsed.success) {
      throw new ValidationError(parsed.error.issues[0]?.message ?? "Datos de marca inválidos.");
    }
    const input = parsed.data;

    const user = await requireUser();
    const membership = await requireAgencyAccess(agencySlug);
    assertBrandingManage(membership.roles);

    const client = await createClient();
    const limits = await getAgencyPlanLimits(client, membership.agencyId);

    if (input.hideCodtrackedBranding && !planAllowsWhiteLabel(limits)) {
      throw new ValidationError(
        "Ocultar el branding de CODTracked requiere un plan con white-label (Growth o Scale).",
      );
    }
    if (input.isWhiteLabelEnabled && !planAllowsWhiteLabel(limits)) {
      throw new ValidationError("White-label no está incluido en tu plan actual.");
    }

    const row = {
      agency_id: membership.agencyId,
      product_name: input.productName ?? null,
      primary_color: input.primaryColor ?? null,
      secondary_color: input.secondaryColor ?? null,
      logo_url: input.logoUrl ?? null,
      favicon_url: input.faviconUrl ?? null,
      login_background_url: input.loginBackgroundUrl ?? null,
      support_email: input.supportEmail ?? null,
      support_whatsapp: input.supportWhatsapp ?? null,
      hide_codtracked_branding: input.hideCodtrackedBranding ?? false,
      updated_at: new Date().toISOString(),
      metadata: { schema_version: 1 } as Json,
    };

    const { error } = await client.from("white_label_settings").upsert(row, { onConflict: "agency_id" });
    if (error) throw error;

    if (typeof input.isWhiteLabelEnabled === "boolean" || input.logoUrl !== undefined) {
      await client
        .from("agencies")
        .update({
          ...(typeof input.isWhiteLabelEnabled === "boolean"
            ? { is_white_label_enabled: input.isWhiteLabelEnabled }
            : {}),
          ...(input.logoUrl !== undefined ? { logo_url: input.logoUrl } : {}),
          updated_at: new Date().toISOString(),
        })
        .eq("id", membership.agencyId);
    }

    await writeAuditLog({
      action: "branding_updated",
      entityType: "white_label_settings",
      entityId: membership.agencyId,
      actorId: user.id,
      agencyId: membership.agencyId,
      newData: {
        productName: row.product_name,
        primaryColor: row.primary_color,
        hideBranding: row.hide_codtracked_branding,
      },
    });

    revalidatePath(routes.agency.branding(agencySlug));
    return actionOk();
  } catch (error) {
    return actionFail(error);
  }
}

export async function restoreBrandingDefaults(agencySlug: string): Promise<BrandingActionResult> {
  try {
    const user = await requireUser();
    const membership = await requireAgencyAccess(agencySlug);
    assertBrandingManage(membership.roles);

    const client = await createClient();
    const { error } = await client.from("white_label_settings").upsert(
      {
        agency_id: membership.agencyId,
        product_name: BRANDING_DEFAULTS.productName,
        primary_color: BRANDING_DEFAULTS.primaryColor,
        secondary_color: BRANDING_DEFAULTS.secondaryColor,
        logo_url: null,
        favicon_url: null,
        login_background_url: null,
        support_email: null,
        support_whatsapp: null,
        hide_codtracked_branding: false,
        updated_at: new Date().toISOString(),
        metadata: { schema_version: 1, restored: true } as Json,
      },
      { onConflict: "agency_id" },
    );
    if (error) throw error;

    await client
      .from("agencies")
      .update({
        is_white_label_enabled: false,
        logo_url: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", membership.agencyId);

    await writeAuditLog({
      action: "branding_defaults_restored",
      entityType: "white_label_settings",
      entityId: membership.agencyId,
      actorId: user.id,
      agencyId: membership.agencyId,
    });

    revalidatePath(routes.agency.branding(agencySlug));
    return actionOk();
  } catch (error) {
    return actionFail(error);
  }
}
