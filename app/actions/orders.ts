"use server";

import { revalidatePath } from "next/cache";
import { routes } from "@/config/routes";
import { actionFail, type ActionResult } from "@/lib/actions/action-result";
import { writeAuditLog } from "@/lib/audit/write-audit";
import { requireUser } from "@/lib/auth/require-user";
import { recordPurchaseConversionEvent } from "@/lib/conversions/record-purchase-conversion";
import { ValidationError } from "@/lib/errors";
import { toUserMessage } from "@/lib/errors/to-user-message";
import { logger } from "@/lib/observability/logger";
import {
  assertCanManageOrders,
  assertConfirmationTransition,
  assertOrderStatusTransition,
  assertPaymentStatusTransition,
} from "@/lib/orders/transitions";
import { can } from "@/lib/permissions/can";
import { createClient } from "@/lib/supabase/server";
import { requireStoreAccess } from "@/lib/tenant/require-store-access";
import { getOrderById } from "@/services/orders.service";
import type { ConfirmationStatus, OrderStatus, PaymentStatus } from "@/types/orders";

export type OrderActionResult = ActionResult;

async function loadManagedOrder(agencySlug: string, storeSlug: string, orderId: string) {
  const user = await requireUser();
  const membership = await requireStoreAccess(agencySlug, storeSlug);
  assertCanManageOrders(can(membership.roles, "orders.manage"));
  if (!membership.storeId) throw new ValidationError("Tienda inválida.");
  const client = await createClient();
  const order = await getOrderById(client, membership.storeId, orderId);
  if (!order) throw new ValidationError("Pedido no encontrado en esta tienda.");
  return { user, membership, client, order };
}

function revalidateOrder(agencySlug: string, storeSlug: string, orderId: string) {
  revalidatePath(routes.store.orders(agencySlug, storeSlug));
  revalidatePath(routes.store.orderDetail(agencySlug, storeSlug, orderId));
}

async function appendStatusHistory(
  client: Awaited<ReturnType<typeof createClient>>,
  order: { id: string; store_id: string; order_status: OrderStatus },
  next: OrderStatus,
  reason: string,
) {
  await client.from("order_status_history").insert({
    store_id: order.store_id,
    order_id: order.id,
    previous_status: order.order_status,
    new_status: next,
    occurred_at: new Date().toISOString(),
    reason_code: "manual",
    reason_detail: reason,
    metadata: {},
  });
}

export async function confirmOrder(
  agencySlug: string,
  storeSlug: string,
  orderId: string,
): Promise<OrderActionResult> {
  try {
    const { user, membership, client, order } = await loadManagedOrder(agencySlug, storeSlug, orderId);
    const nextStatus: OrderStatus = "confirmed";
    assertOrderStatusTransition(order.order_status, nextStatus);
    assertConfirmationTransition(order.confirmation_status, "confirmed");
    const { error } = await client
      .from("orders")
      .update({
        order_status: nextStatus,
        confirmation_status: "confirmed" satisfies ConfirmationStatus,
        confirmed_at: new Date().toISOString(),
      })
      .eq("id", order.id)
      .eq("store_id", order.store_id);
    if (error) return { error: toUserMessage(error) };
    await appendStatusHistory(client, order, nextStatus, "Confirmación manual");
    await writeAuditLog({
      action: "order_confirmed",
      entityType: "order",
      entityId: order.id,
      actorId: user.id,
      agencyId: membership.agencyId,
      storeId: membership.storeId,
      oldData: { order_status: order.order_status, confirmation_status: order.confirmation_status },
      newData: { order_status: nextStatus, confirmation_status: "confirmed" },
    });
    revalidateOrder(agencySlug, storeSlug, orderId);
    return {};
  } catch (error) {
    return actionFail(error);
  }
}

export async function cancelOrRejectOrder(
  agencySlug: string,
  storeSlug: string,
  orderId: string,
  outcome: "cancelled" | "rejected",
  reason?: string,
): Promise<OrderActionResult> {
  try {
    const { user, membership, client, order } = await loadManagedOrder(agencySlug, storeSlug, orderId);
    assertOrderStatusTransition(order.order_status, outcome);
    if (outcome === "rejected") {
      assertConfirmationTransition(order.confirmation_status, "rejected");
    }
    const { error } = await client
      .from("orders")
      .update({
        order_status: outcome,
        confirmation_status: outcome === "rejected" ? "rejected" : order.confirmation_status,
        cancelled_at: new Date().toISOString(),
      })
      .eq("id", order.id)
      .eq("store_id", order.store_id);
    if (error) return { error: toUserMessage(error) };
    await appendStatusHistory(client, order, outcome, reason?.trim() || `Pedido ${outcome} manualmente`);
    await writeAuditLog({
      action: outcome === "cancelled" ? "order_cancelled" : "order_rejected",
      entityType: "order",
      entityId: order.id,
      actorId: user.id,
      agencyId: membership.agencyId,
      storeId: membership.storeId,
      oldData: { order_status: order.order_status },
      newData: { order_status: outcome, reason: reason?.trim() || null },
    });
    revalidateOrder(agencySlug, storeSlug, orderId);
    return {};
  } catch (error) {
    return actionFail(error);
  }
}

export async function updateOrderPaymentStatus(
  agencySlug: string,
  storeSlug: string,
  orderId: string,
  next: PaymentStatus,
  options: { adminOverride?: boolean; justification?: string } = {},
): Promise<OrderActionResult> {
  try {
    const { user, membership, client, order } = await loadManagedOrder(agencySlug, storeSlug, orderId);
    const adminOverride = Boolean(options.adminOverride && can(membership.roles, "agency.manage"));
    assertPaymentStatusTransition(order.payment_status, next, { adminOverride });
    if (adminOverride && next === "settled" && order.payment_status !== "settlement_pending") {
      if (!options.justification?.trim()) {
        throw new ValidationError("La conciliación forzada requiere justificación.");
      }
    }
    const patch: {
      payment_status: PaymentStatus;
      cash_collected_at?: string;
      collected_cod_amount?: number | null;
      settled_at?: string;
      settled_cod_amount?: number | null;
    } = { payment_status: next };
    if (next === "cash_collected" || next === "partially_collected") {
      patch.cash_collected_at = new Date().toISOString();
      patch.collected_cod_amount = order.expected_cod_amount ?? order.total_amount;
    }
    if (next === "settled") {
      patch.settled_at = new Date().toISOString();
      patch.settled_cod_amount = order.collected_cod_amount ?? order.expected_cod_amount ?? order.total_amount;
    }
    const { error } = await client.from("orders").update(patch).eq("id", order.id).eq("store_id", order.store_id);
    if (error) return { error: toUserMessage(error) };

    if (next === "cash_collected" || next === "partially_collected") {
      try {
        await recordPurchaseConversionEvent({
          admin: client,
          agencyId: membership.agencyId,
          storeId: order.store_id,
          orderId: order.id,
          value: Number(patch.collected_cod_amount ?? order.total_amount ?? 0),
          currencyCode: order.currency_code || "PEN",
          eventTime: patch.cash_collected_at,
        });
      } catch (convErr) {
        logger.warn("order.payment.conversion_record_failed", {
          order_id: order.id,
          error: convErr instanceof Error ? convErr.message : "conversion_failed",
        });
      }
    }

    await writeAuditLog({
      action: "order_payment_status_changed",
      entityType: "order",
      entityId: order.id,
      actorId: user.id,
      agencyId: membership.agencyId,
      storeId: membership.storeId,
      oldData: { payment_status: order.payment_status },
      newData: {
        payment_status: next,
        admin_override: adminOverride,
        justification: options.justification?.trim() || null,
      },
    });
    revalidateOrder(agencySlug, storeSlug, orderId);
    return {};
  } catch (error) {
    return actionFail(error);
  }
}

export async function markOrderForReview(
  agencySlug: string,
  storeSlug: string,
  orderId: string,
): Promise<OrderActionResult> {
  try {
    const { user, membership, client, order } = await loadManagedOrder(agencySlug, storeSlug, orderId);
    assertConfirmationTransition(order.confirmation_status, "manual_review");
    const { error } = await client
      .from("orders")
      .update({ confirmation_status: "manual_review" satisfies ConfirmationStatus })
      .eq("id", order.id)
      .eq("store_id", order.store_id);
    if (error) return { error: toUserMessage(error) };
    await writeAuditLog({
      action: "order_marked_for_review",
      entityType: "order",
      entityId: order.id,
      actorId: user.id,
      agencyId: membership.agencyId,
      storeId: membership.storeId,
      oldData: { confirmation_status: order.confirmation_status },
      newData: { confirmation_status: "manual_review" },
    });
    revalidateOrder(agencySlug, storeSlug, orderId);
    return {};
  } catch (error) {
    return actionFail(error);
  }
}

export async function addOrderNote(
  agencySlug: string,
  storeSlug: string,
  orderId: string,
  body: string,
): Promise<OrderActionResult> {
  try {
    const { user, membership, client, order } = await loadManagedOrder(agencySlug, storeSlug, orderId);
    const text = body.trim();
    if (!text) throw new ValidationError("La nota no puede estar vacía.");
    if (text.length > 4000) throw new ValidationError("La nota es demasiado larga.");
    const { error } = await client.from("order_notes").insert({
      agency_id: membership.agencyId,
      store_id: order.store_id,
      order_id: order.id,
      author_id: user.id,
      body: text,
    });
    if (error) return { error: toUserMessage(error) };
    await writeAuditLog({
      action: "order_note_added",
      entityType: "order",
      entityId: order.id,
      actorId: user.id,
      agencyId: membership.agencyId,
      storeId: membership.storeId,
      newData: { body_preview: text.slice(0, 120) },
    });
    revalidateOrder(agencySlug, storeSlug, orderId);
    return {};
  } catch (error) {
    return actionFail(error);
  }
}

export async function createOrderAlert(
  agencySlug: string,
  storeSlug: string,
  orderId: string,
  input: { title: string; body?: string; severity?: "info" | "warning" | "critical" },
): Promise<OrderActionResult> {
  try {
    const { user, membership, client, order } = await loadManagedOrder(agencySlug, storeSlug, orderId);
    const title = input.title.trim();
    if (!title) throw new ValidationError("Ingresa un título para la alerta.");
    const { error } = await client.from("alerts").insert({
      agency_id: membership.agencyId,
      store_id: order.store_id,
      order_id: order.id,
      type: "manual_order_review",
      title,
      body: input.body?.trim() || null,
      severity: input.severity ?? "warning",
      data: { source: "manual" },
    });
    if (error) return { error: toUserMessage(error) };
    await writeAuditLog({
      action: "order_alert_created",
      entityType: "order",
      entityId: order.id,
      actorId: user.id,
      agencyId: membership.agencyId,
      storeId: membership.storeId,
      newData: { title },
    });
    revalidateOrder(agencySlug, storeSlug, orderId);
    return {};
  } catch (error) {
    return actionFail(error);
  }
}
