"use server";

import { revalidatePath } from "next/cache";
import { actionFail, actionOk, type ActionResult } from "@/lib/actions/action-result";
import { writeAuditLog } from "@/lib/audit/write-audit";
import { requireUser } from "@/lib/auth/require-user";
import { routes } from "@/config/routes";
import { ValidationError } from "@/lib/errors";
import type { Role } from "@/config/permissions";
import { can } from "@/lib/permissions/can";
import { createClient } from "@/lib/supabase/server";
import { requireStoreAccess } from "@/lib/tenant/require-store-access";
import { getAlertById } from "@/services/alerts.service";

export type AlertActionResult = ActionResult<{ alertId?: string }>;

function assertAlertsManage(roles: readonly Role[]) {
  if (!can(roles, "alerts.manage")) {
    throw new ValidationError("No tienes permiso para gestionar alertas.");
  }
}

function revalidateAlerts(agencySlug: string, storeSlug: string, alertId?: string) {
  revalidatePath(routes.store.alerts(agencySlug, storeSlug));
  if (alertId) revalidatePath(routes.store.alertDetail(agencySlug, storeSlug, alertId));
}

export async function acknowledgeAlert(
  agencySlug: string,
  storeSlug: string,
  alertId: string,
): Promise<AlertActionResult> {
  try {
    const user = await requireUser();
    const membership = await requireStoreAccess(agencySlug, storeSlug);
    assertAlertsManage(membership.roles);
    if (!membership.storeId) throw new ValidationError("Tienda inválida.");

    const client = await createClient();
    const alert = await getAlertById(client, membership.storeId, alertId);
    if (!alert) throw new ValidationError("Alerta no encontrada.");

    const now = new Date().toISOString();
    await client
      .from("alerts")
      .update({
        status: "acknowledged",
        acknowledged_at: now,
        acknowledged_by: user.id,
        updated_at: now,
      })
      .eq("id", alertId)
      .eq("store_id", membership.storeId);

    await writeAuditLog({
      action: "alert_acknowledged",
      entityType: "alert",
      entityId: alertId,
      actorId: user.id,
      agencyId: membership.agencyId,
      storeId: membership.storeId,
    });

    revalidateAlerts(agencySlug, storeSlug, alertId);
    return actionOk({ alertId });
  } catch (error) {
    return actionFail(error);
  }
}

export async function assignAlert(
  agencySlug: string,
  storeSlug: string,
  alertId: string,
  assignedTo: string | null,
): Promise<AlertActionResult> {
  try {
    const user = await requireUser();
    const membership = await requireStoreAccess(agencySlug, storeSlug);
    assertAlertsManage(membership.roles);
    if (!membership.storeId) throw new ValidationError("Tienda inválida.");

    const client = await createClient();
    await client
      .from("alerts")
      .update({ assigned_to: assignedTo, updated_at: new Date().toISOString() })
      .eq("id", alertId)
      .eq("store_id", membership.storeId);

    await writeAuditLog({
      action: "alert_assigned",
      entityType: "alert",
      entityId: alertId,
      actorId: user.id,
      agencyId: membership.agencyId,
      storeId: membership.storeId,
      newData: { assignedTo },
    });

    revalidateAlerts(agencySlug, storeSlug, alertId);
    return actionOk({ alertId });
  } catch (error) {
    return actionFail(error);
  }
}

export async function resolveAlert(
  agencySlug: string,
  storeSlug: string,
  alertId: string,
): Promise<AlertActionResult> {
  try {
    const user = await requireUser();
    const membership = await requireStoreAccess(agencySlug, storeSlug);
    assertAlertsManage(membership.roles);
    if (!membership.storeId) throw new ValidationError("Tienda inválida.");

    const client = await createClient();
    const now = new Date().toISOString();
    await client
      .from("alerts")
      .update({
        status: "resolved",
        resolved_at: now,
        resolved_by: user.id,
        updated_at: now,
      })
      .eq("id", alertId)
      .eq("store_id", membership.storeId);

    await writeAuditLog({
      action: "alert_resolved",
      entityType: "alert",
      entityId: alertId,
      actorId: user.id,
      agencyId: membership.agencyId,
      storeId: membership.storeId,
    });

    revalidateAlerts(agencySlug, storeSlug, alertId);
    return actionOk({ alertId });
  } catch (error) {
    return actionFail(error);
  }
}

export async function reopenAlert(
  agencySlug: string,
  storeSlug: string,
  alertId: string,
): Promise<AlertActionResult> {
  try {
    const user = await requireUser();
    const membership = await requireStoreAccess(agencySlug, storeSlug);
    assertAlertsManage(membership.roles);
    if (!membership.storeId) throw new ValidationError("Tienda inválida.");

    const client = await createClient();
    await client
      .from("alerts")
      .update({
        status: "reopened",
        resolved_at: null,
        resolved_by: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", alertId)
      .eq("store_id", membership.storeId);

    await writeAuditLog({
      action: "alert_reopened",
      entityType: "alert",
      entityId: alertId,
      actorId: user.id,
      agencyId: membership.agencyId,
      storeId: membership.storeId,
    });

    revalidateAlerts(agencySlug, storeSlug, alertId);
    return actionOk({ alertId });
  } catch (error) {
    return actionFail(error);
  }
}

export async function silenceAlert(
  agencySlug: string,
  storeSlug: string,
  alertId: string,
  hours = 24,
): Promise<AlertActionResult> {
  try {
    const user = await requireUser();
    const membership = await requireStoreAccess(agencySlug, storeSlug);
    assertAlertsManage(membership.roles);
    if (!membership.storeId) throw new ValidationError("Tienda inválida.");

    const until = new Date(Date.now() + hours * 3600_000).toISOString();
    const client = await createClient();
    await client
      .from("alerts")
      .update({
        status: "silenced",
        silenced_until: until,
        updated_at: new Date().toISOString(),
      })
      .eq("id", alertId)
      .eq("store_id", membership.storeId);

    await writeAuditLog({
      action: "alert_silenced",
      entityType: "alert",
      entityId: alertId,
      actorId: user.id,
      agencyId: membership.agencyId,
      storeId: membership.storeId,
      newData: { silencedUntil: until },
    });

    revalidateAlerts(agencySlug, storeSlug, alertId);
    return actionOk({ alertId });
  } catch (error) {
    return actionFail(error);
  }
}

export async function addAlertNote(
  agencySlug: string,
  storeSlug: string,
  alertId: string,
  body: string,
): Promise<AlertActionResult> {
  try {
    const user = await requireUser();
    const membership = await requireStoreAccess(agencySlug, storeSlug);
    assertAlertsManage(membership.roles);
    if (!membership.storeId || !membership.agencyId) throw new ValidationError("Tienda inválida.");
    const trimmed = body.trim();
    if (!trimmed) throw new ValidationError("La nota no puede estar vacía.");

    const client = await createClient();
    const alert = await getAlertById(client, membership.storeId, alertId);
    if (!alert) throw new ValidationError("Alerta no encontrada.");

    await client.from("alert_notes").insert({
      agency_id: membership.agencyId,
      store_id: membership.storeId,
      alert_id: alertId,
      author_id: user.id,
      body: trimmed.slice(0, 4000),
    });

    await writeAuditLog({
      action: "alert_note_added",
      entityType: "alert",
      entityId: alertId,
      actorId: user.id,
      agencyId: membership.agencyId,
      storeId: membership.storeId,
    });

    revalidateAlerts(agencySlug, storeSlug, alertId);
    return actionOk({ alertId });
  } catch (error) {
    return actionFail(error);
  }
}

export async function bulkResolveAlerts(
  agencySlug: string,
  storeSlug: string,
  alertIds: string[],
): Promise<AlertActionResult> {
  try {
    const user = await requireUser();
    const membership = await requireStoreAccess(agencySlug, storeSlug);
    assertAlertsManage(membership.roles);
    if (!membership.storeId) throw new ValidationError("Tienda inválida.");
    const ids = alertIds.filter(Boolean).slice(0, 50);
    if (!ids.length) throw new ValidationError("Selecciona al menos una alerta.");

    const client = await createClient();
    const now = new Date().toISOString();
    await client
      .from("alerts")
      .update({
        status: "resolved",
        resolved_at: now,
        resolved_by: user.id,
        updated_at: now,
      })
      .eq("store_id", membership.storeId)
      .in("id", ids);

    await writeAuditLog({
      action: "alert_bulk_resolved",
      entityType: "alert",
      entityId: ids[0],
      actorId: user.id,
      agencyId: membership.agencyId,
      storeId: membership.storeId,
      newData: { count: ids.length, ids },
    });

    revalidateAlerts(agencySlug, storeSlug);
    return actionOk({});
  } catch (error) {
    return actionFail(error);
  }
}
