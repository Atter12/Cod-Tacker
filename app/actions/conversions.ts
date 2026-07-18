"use server";

import { revalidatePath } from "next/cache";
import { routes } from "@/config/routes";
import { actionFail, type ActionResult } from "@/lib/actions/action-result";
import { writeAuditLog } from "@/lib/audit/write-audit";
import { requireUser } from "@/lib/auth/require-user";
import { sendQueuedPurchaseConversion } from "@/lib/conversions/record-purchase-conversion";
import { ValidationError } from "@/lib/errors";
import { toUserMessage } from "@/lib/errors/to-user-message";
import { can } from "@/lib/permissions/can";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireStoreAccess } from "@/lib/tenant/require-store-access";

export type ConversionActionResult = ActionResult<{
  deliveryStatus?: string;
}>;

async function loadManagedConversion(
  agencySlug: string,
  storeSlug: string,
  conversionEventId: string,
) {
  const user = await requireUser();
  const membership = await requireStoreAccess(agencySlug, storeSlug);
  if (!can(membership.roles, "orders.manage")) {
    throw new ValidationError("No tienes permiso para gestionar conversiones.");
  }
  const storeId = membership.storeId;
  const agencyId = membership.agencyId;
  if (!storeId || !agencyId) {
    throw new ValidationError("Tienda inválida.");
  }

  // Service role: conversion_events writes are not granted to user RLS roles.
  const admin = createAdminClient();
  const row = await admin
    .from("conversion_events")
    .select("id, order_id, event_id, status, sent_at, release_status, hold_reason")
    .eq("id", conversionEventId)
    .eq("store_id", storeId)
    .maybeSingle();
  if (row.error) throw new ValidationError(toUserMessage(row.error));
  if (!row.data) throw new ValidationError("Conversión no encontrada en esta tienda.");

  return { user, storeId, agencyId, admin, event: row.data };
}

function revalidateConversion(
  agencySlug: string,
  storeSlug: string,
  orderId: string,
) {
  revalidatePath(routes.store.orders(agencySlug, storeSlug));
  revalidatePath(routes.store.orderDetail(agencySlug, storeSlug, orderId));
}

/**
 * Manually release a held Purchase candidate and send it to Meta/TikTok.
 * Also serves as "retry send" for released candidates that previously failed.
 */
export async function releaseAndSendConversionEvent(
  agencySlug: string,
  storeSlug: string,
  conversionEventId: string,
): Promise<ConversionActionResult> {
  try {
    const { user, storeId, agencyId, admin, event } = await loadManagedConversion(
      agencySlug,
      storeSlug,
      conversionEventId,
    );

    if (event.sent_at) {
      throw new ValidationError("Esta conversión ya fue enviada.");
    }

    // Releasing a rejected candidate is allowed while unsent (operator reversal).
    const previousStatus = event.release_status;
    if (previousStatus !== "released") {
      const upd = await admin
        .from("conversion_events")
        .update({
          release_status: "released",
          released_at: new Date().toISOString(),
          released_by: user.id,
          hold_reason: null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", event.id)
        .eq("store_id", storeId);
      if (upd.error) return { error: toUserMessage(upd.error) };
    }

    const result = await sendQueuedPurchaseConversion({
      admin,
      agencyId,
      storeId,
      conversionEventRowId: event.id,
    });

    await writeAuditLog({
      action: "conversion_released",
      entityType: "conversion_event",
      entityId: event.id,
      actorId: user.id,
      agencyId,
      storeId,
      oldData: { release_status: previousStatus, hold_reason: event.hold_reason },
      newData: {
        release_status: "released",
        delivery_status: result.deliveryStatus,
        event_id: event.event_id,
      },
    });

    revalidateConversion(agencySlug, storeSlug, event.order_id);
    if (result.deliveryStatus === "failed") {
      return {
        error: "La conversión fue liberada pero el envío falló. Revisa credenciales y reintenta.",
      };
    }
    return { deliveryStatus: result.deliveryStatus };
  } catch (error) {
    return actionFail(error);
  }
}

/** Reject a held candidate so it is never sent to Meta/TikTok. */
export async function rejectConversionEvent(
  agencySlug: string,
  storeSlug: string,
  conversionEventId: string,
  reason?: string,
): Promise<ConversionActionResult> {
  try {
    const { user, storeId, agencyId, admin, event } = await loadManagedConversion(
      agencySlug,
      storeSlug,
      conversionEventId,
    );

    if (event.sent_at) {
      throw new ValidationError("No se puede rechazar: la conversión ya fue enviada.");
    }
    if (event.release_status === "rejected") {
      throw new ValidationError("La conversión ya está rechazada.");
    }

    const upd = await admin
      .from("conversion_events")
      .update({
        release_status: "rejected",
        released_at: new Date().toISOString(),
        released_by: user.id,
        hold_reason: reason?.trim().slice(0, 500) || "manual_reject",
        status: "cancelled",
        updated_at: new Date().toISOString(),
      })
      .eq("id", event.id)
      .eq("store_id", storeId);
    if (upd.error) return { error: toUserMessage(upd.error) };

    await writeAuditLog({
      action: "conversion_rejected",
      entityType: "conversion_event",
      entityId: event.id,
      actorId: user.id,
      agencyId,
      storeId,
      oldData: { release_status: event.release_status, status: event.status },
      newData: {
        release_status: "rejected",
        status: "cancelled",
        reason: reason?.trim() || null,
        event_id: event.event_id,
      },
    });

    revalidateConversion(agencySlug, storeSlug, event.order_id);
    return { deliveryStatus: "cancelled" };
  } catch (error) {
    return actionFail(error);
  }
}
