"use server";

import { revalidatePath } from "next/cache";
import { actionFail, actionOk, type ActionResult } from "@/lib/actions/action-result";
import { writeAuditLog } from "@/lib/audit/write-audit";
import { requireUser } from "@/lib/auth/require-user";
import { routes } from "@/config/routes";
import { ValidationError } from "@/lib/errors";
import type { Role } from "@/config/permissions";
import { can } from "@/lib/permissions/can";
import { enqueueRawEventAndJob } from "@/lib/jobs/enqueue";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { requireAgencyAccess } from "@/lib/tenant/require-agency-access";
import type { Json } from "@/types/database";

export type PrivacyActionResult = ActionResult<{ requestId?: string; jobId?: string }>;

function assertAgencyManage(roles: readonly Role[]) {
  if (!can(roles, "agency.manage")) {
    throw new ValidationError("No tienes permiso para solicitudes de privacidad.");
  }
}

export async function requestDataExport(
  agencySlug: string,
  input: { scope: "store" | "agency"; storeId?: string | null },
): Promise<PrivacyActionResult> {
  try {
    const user = await requireUser();
    const membership = await requireAgencyAccess(agencySlug);
    assertAgencyManage(membership.roles);

    if (input.scope === "store" && !input.storeId) {
      throw new ValidationError("Selecciona una tienda para exportar.");
    }

    const client = await createClient();
    const { data: request, error } = await client
      .from("data_export_requests")
      .insert({
        agency_id: membership.agencyId,
        store_id: input.scope === "store" ? input.storeId! : null,
        requested_by: user.id,
        scope: input.scope,
        status: "pending",
      })
      .select("id")
      .single();
    if (error || !request) throw error ?? new ValidationError("No se pudo crear la solicitud.");

    const admin = createAdminClient();
    const enqueued = await enqueueRawEventAndJob(admin, {
      agencyId: membership.agencyId,
      storeId: input.storeId ?? null,
      provider: "other",
      eventType: "privacy.data_export",
      jobType: "privacy.data_export.mock",
      idempotencyKey: `privacy-export:${request.id}`,
      correlationId: request.id,
      payload: { requestId: request.id, scope: input.scope } as Json,
    });

    await client
      .from("data_export_requests")
      .update({ job_id: enqueued.jobId, updated_at: new Date().toISOString() })
      .eq("id", request.id);

    await writeAuditLog({
      action: "data_export_requested",
      entityType: "data_export_request",
      entityId: request.id,
      actorId: user.id,
      agencyId: membership.agencyId,
      storeId: input.storeId ?? null,
      newData: { scope: input.scope, jobId: enqueued.jobId },
    });

    revalidatePath(routes.agency.billing(agencySlug));
    return actionOk({ requestId: request.id, jobId: enqueued.jobId });
  } catch (error) {
    return actionFail(error);
  }
}

export async function requestDataDeletion(
  agencySlug: string,
  input: { scope: "store" | "agency"; storeId?: string | null; reason?: string },
): Promise<PrivacyActionResult> {
  try {
    const user = await requireUser();
    const membership = await requireAgencyAccess(agencySlug);
    assertAgencyManage(membership.roles);

    if (input.scope === "store" && !input.storeId) {
      throw new ValidationError("Selecciona una tienda.");
    }

    const client = await createClient();
    const { data: request, error } = await client
      .from("data_deletion_requests")
      .insert({
        agency_id: membership.agencyId,
        store_id: input.scope === "store" ? input.storeId! : null,
        requested_by: user.id,
        scope: input.scope,
        reason: input.reason?.trim().slice(0, 500) || null,
        status: "pending_approval",
      })
      .select("id")
      .single();
    if (error || !request) throw error ?? new ValidationError("No se pudo crear la solicitud.");

    await writeAuditLog({
      action: "data_deletion_requested",
      entityType: "data_deletion_request",
      entityId: request.id,
      actorId: user.id,
      agencyId: membership.agencyId,
      storeId: input.storeId ?? null,
      newData: {
        scope: input.scope,
        note: "Solicitud registrada. El borrado destructivo NO se ejecuta de inmediato.",
      },
    });

    return actionOk({ requestId: request.id });
  } catch (error) {
    return actionFail(error);
  }
}
