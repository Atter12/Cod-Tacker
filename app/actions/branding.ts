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
import {
  AGENCY_BRANDING_BUCKET,
  assertBrandAssetSize,
  brandAssetColumn,
  brandAssetObjectPath,
  decodeBrandBase64,
  isBrandAssetKind,
  publicUrlForBrandObject,
  resolveBrandMimeAndExt,
  type BrandAssetKind,
} from "@/lib/branding/storage";
import { getAgencyPlanLimits, planAllowsWhiteLabel } from "@/lib/billing/limits";
import { createClient } from "@/lib/supabase/server";
import { getPublicEnv } from "@/config/env";
import { requireAgencyAccess } from "@/lib/tenant/require-agency-access";
import type { Json } from "@/types/database";

export type BrandingActionResult = ActionResult;
export type BrandAssetUploadResult = ActionResult<{ url: string; kind: BrandAssetKind }>;

function assertBrandingManage(roles: readonly Role[]) {
  if (!can(roles, "branding.manage")) {
    throw new ValidationError("No tienes permiso para gestionar la marca.");
  }
}

function revalidateBrandPaths(agencySlug: string) {
  revalidatePath(routes.agency.branding(agencySlug));
  revalidatePath(routes.agency.stores(agencySlug));
  revalidatePath(`/a/${agencySlug}`, "layout");
}

async function readUploadBytes(formData: FormData): Promise<{
  bytes: Buffer;
  contentType: string;
  ext: string;
  filename: string;
}> {
  const fileValue = formData.get("file");
  if (fileValue instanceof File && fileValue.size > 0) {
    const { contentType, ext } = resolveBrandMimeAndExt({
      contentType: fileValue.type,
      filename: fileValue.name,
    });
    const bytes = Buffer.from(await fileValue.arrayBuffer());
    assertBrandAssetSize(bytes.byteLength);
    return { bytes, contentType, ext, filename: fileValue.name };
  }

  const base64 = formData.get("base64");
  if (typeof base64 === "string" && base64.trim()) {
    const filename =
      typeof formData.get("filename") === "string"
        ? String(formData.get("filename"))
        : "upload.png";
    const declaredType =
      typeof formData.get("contentType") === "string"
        ? String(formData.get("contentType"))
        : null;
    const dataUrlMime = base64.startsWith("data:")
      ? base64.slice(5, base64.indexOf(";"))
      : null;
    const { contentType, ext } = resolveBrandMimeAndExt({
      contentType: declaredType || dataUrlMime,
      filename,
    });
    const bytes = decodeBrandBase64(base64);
    assertBrandAssetSize(bytes.byteLength);
    return { bytes, contentType, ext, filename };
  }

  throw new ValidationError("Selecciona una imagen para subir.");
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

    revalidateBrandPaths(agencySlug);
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

    revalidateBrandPaths(agencySlug);
    return actionOk();
  } catch (error) {
    return actionFail(error);
  }
}

/**
 * Upload logo / favicon / login background to Storage and persist the public URL.
 * Accepts multipart `file` or `base64` (+ optional filename/contentType).
 */
export async function uploadAgencyBrandAsset(
  agencySlug: string,
  kindRaw: string,
  formData: FormData,
): Promise<BrandAssetUploadResult> {
  try {
    if (!isBrandAssetKind(kindRaw)) {
      throw new ValidationError("Tipo de recurso de marca inválido.");
    }
    const kind = kindRaw;

    const user = await requireUser();
    const membership = await requireAgencyAccess(agencySlug);
    assertBrandingManage(membership.roles);

    const { bytes, contentType, ext } = await readUploadBytes(formData);
    const objectPath = brandAssetObjectPath(membership.agencyId, kind, ext);
    const client = await createClient();

    const upload = await client.storage.from(AGENCY_BRANDING_BUCKET).upload(objectPath, bytes, {
      contentType,
      upsert: true,
      cacheControl: "3600",
    });
    if (upload.error) {
      throw new ValidationError(
        upload.error.message?.includes("Bucket not found")
          ? "El bucket agency-branding no existe o no es accesible."
          : "No se pudo subir la imagen. Revisa permisos de Storage.",
      );
    }

    const env = getPublicEnv();
    const url = publicUrlForBrandObject(env.NEXT_PUBLIC_SUPABASE_URL, objectPath);
    const column = brandAssetColumn(kind);
    const now = new Date().toISOString();

    const { data: existing } = await client
      .from("white_label_settings")
      .select("agency_id")
      .eq("agency_id", membership.agencyId)
      .maybeSingle();

    if (existing) {
      const patch =
        column === "logo_url"
          ? { logo_url: url, updated_at: now }
          : column === "favicon_url"
            ? { favicon_url: url, updated_at: now }
            : { login_background_url: url, updated_at: now };
      const { error } = await client
        .from("white_label_settings")
        .update(patch)
        .eq("agency_id", membership.agencyId);
      if (error) throw error;
    } else {
      const { error } = await client.from("white_label_settings").insert({
        agency_id: membership.agencyId,
        product_name: BRANDING_DEFAULTS.productName,
        primary_color: BRANDING_DEFAULTS.primaryColor,
        secondary_color: BRANDING_DEFAULTS.secondaryColor,
        logo_url: column === "logo_url" ? url : null,
        favicon_url: column === "favicon_url" ? url : null,
        login_background_url: column === "login_background_url" ? url : null,
        metadata: { schema_version: 1 } as Json,
      });
      if (error) throw error;
    }

    if (kind === "logo") {
      await client
        .from("agencies")
        .update({ logo_url: url, updated_at: new Date().toISOString() })
        .eq("id", membership.agencyId);
    }

    await writeAuditLog({
      action: "branding_asset_uploaded",
      entityType: "white_label_settings",
      entityId: membership.agencyId,
      actorId: user.id,
      agencyId: membership.agencyId,
      newData: { kind, path: objectPath, url },
    });

    revalidateBrandPaths(agencySlug);
    return actionOk({ url, kind });
  } catch (error) {
    return actionFail(error);
  }
}
