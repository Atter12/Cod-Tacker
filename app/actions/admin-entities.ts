"use server";

import { revalidatePath } from "next/cache";
import { actionFail, actionOk, type ActionResult } from "@/lib/actions/action-result";
import { writeAuditLog } from "@/lib/audit/write-audit";
import { requirePlatformAdmin } from "@/lib/auth/require-platform-admin";
import { routes } from "@/config/routes";
import { ValidationError } from "@/lib/errors";
import { createClient } from "@/lib/supabase/server";
import type { Json } from "@/types/database";

export type AdminEntityActionResult = ActionResult;

function revalidateAdmin() {
  revalidatePath(routes.admin.agencies);
  revalidatePath(routes.admin.stores);
  revalidatePath(routes.admin.users);
  revalidatePath(routes.admin.overview);
}

export async function setAgencyActive(
  agencyId: string,
  isActive: boolean,
): Promise<AdminEntityActionResult> {
  try {
    const admin = await requirePlatformAdmin();
    const client = await createClient();
    const { error } = await client
      .from("agencies")
      .update({ is_active: isActive, updated_at: new Date().toISOString() })
      .eq("id", agencyId);
    if (error) throw error;

    await writeAuditLog({
      action: isActive ? "agency_reactivated" : "agency_suspended",
      entityType: "agency",
      entityId: agencyId,
      actorId: admin.id,
      agencyId,
      newData: { isActive },
    });

    revalidateAdmin();
    revalidatePath(routes.admin.agencyDetail(agencyId));
    return actionOk();
  } catch (error) {
    return actionFail(error);
  }
}

export async function setStoreActive(
  storeId: string,
  isActive: boolean,
): Promise<AdminEntityActionResult> {
  try {
    const admin = await requirePlatformAdmin();
    const client = await createClient();
    const { data: store } = await client
      .from("stores")
      .select("id, agency_id")
      .eq("id", storeId)
      .maybeSingle();
    if (!store) throw new ValidationError("Tienda no encontrada.");

    const { error } = await client
      .from("stores")
      .update({ is_active: isActive, updated_at: new Date().toISOString() })
      .eq("id", storeId);
    if (error) throw error;

    await writeAuditLog({
      action: isActive ? "store_reactivated" : "store_suspended",
      entityType: "store",
      entityId: storeId,
      actorId: admin.id,
      agencyId: store.agency_id,
      storeId,
      newData: { isActive },
    });

    revalidateAdmin();
    revalidatePath(routes.admin.storeDetail(storeId));
    return actionOk();
  } catch (error) {
    return actionFail(error);
  }
}

export async function setUserActive(
  userId: string,
  isActive: boolean,
): Promise<AdminEntityActionResult> {
  try {
    const admin = await requirePlatformAdmin();
    if (admin.id === userId) {
      throw new ValidationError("No puedes suspender tu propia cuenta de administrador.");
    }

    const client = await createClient();
    const { error } = await client
      .from("profiles")
      .update({ is_active: isActive, updated_at: new Date().toISOString() })
      .eq("id", userId);
    if (error) throw error;

    await writeAuditLog({
      action: isActive ? "user_reactivated" : "user_suspended",
      entityType: "profile",
      entityId: userId,
      actorId: admin.id,
      newData: { isActive },
    });

    revalidateAdmin();
    revalidatePath(routes.admin.userDetail(userId));
    return actionOk();
  } catch (error) {
    return actionFail(error);
  }
}

/**
 * Audited support access grant — does NOT impersonate the user.
 * Records a time-bounded note in audit logs for compliance.
 */
export async function grantSupportAccessNote(
  agencyId: string,
  reason: string,
): Promise<AdminEntityActionResult> {
  try {
    const admin = await requirePlatformAdmin();
    const trimmed = reason.trim();
    if (trimmed.length < 8) {
      throw new ValidationError("Indica un motivo de soporte (mín. 8 caracteres).");
    }

    await writeAuditLog({
      action: "support_access_granted",
      entityType: "agency",
      entityId: agencyId,
      actorId: admin.id,
      agencyId,
      newData: {
        reason: trimmed.slice(0, 500),
        mode: "audited_note_only",
        note: "Sin impersonación. El admin usa su propio rol platform_* bajo RLS.",
        expiresHint: "24h (política operativa)",
      } as Json,
    });

    revalidatePath(routes.admin.agencyDetail(agencyId));
    revalidatePath(routes.admin.audit);
    return actionOk();
  } catch (error) {
    return actionFail(error);
  }
}

export async function reviewDataDeletionRequest(
  requestId: string,
  decision: "approve" | "reject",
  reviewNotes?: string,
): Promise<AdminEntityActionResult> {
  try {
    const admin = await requirePlatformAdmin();
    const client = await createClient();
    const { data: request } = await client
      .from("data_deletion_requests")
      .select("*")
      .eq("id", requestId)
      .maybeSingle();
    if (!request) throw new ValidationError("Solicitud no encontrada.");
    if (request.status !== "pending_approval") {
      throw new ValidationError("La solicitud ya fue revisada.");
    }

    const status =
      decision === "approve" ? "approved_awaiting_execution" : "rejected";

    const { error } = await client
      .from("data_deletion_requests")
      .update({
        status,
        reviewed_by: admin.id,
        reviewed_at: new Date().toISOString(),
        review_notes: reviewNotes?.trim().slice(0, 500) || null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", requestId);
    if (error) throw error;

    await writeAuditLog({
      action: "data_deletion_reviewed",
      entityType: "data_deletion_request",
      entityId: requestId,
      actorId: admin.id,
      agencyId: request.agency_id,
      storeId: request.store_id,
      newData: {
        status,
        note:
          decision === "approve"
            ? "Aprobado pendiente de ejecución. Borrado destructivo NO automático."
            : "Rechazado",
      },
    });

    revalidatePath(routes.admin.agencies);
    return actionOk();
  } catch (error) {
    return actionFail(error);
  }
}
