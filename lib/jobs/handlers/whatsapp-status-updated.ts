import { z } from "zod";
import { PermanentJobError, RetryableJobError } from "@/lib/jobs/errors";
import type { JobHandler, JobHandlerResult } from "@/lib/jobs/types";
import { inferConfirmationFromBody } from "@/lib/whatsapp/templates";
import { runAutomationsForTrigger } from "@/lib/automations/runner";
import type { Json } from "@/types/database.generated";

export const whatsappStatusUpdatedPayloadSchema = z.object({
  external_message_id: z.string().min(1).max(200),
  status: z.enum(["sent", "delivered", "read", "failed"]),
  error_code: z.string().max(80).optional(),
  error_message: z.string().max(500).optional(),
  retryable: z.boolean().optional(),
  demo_seed: z.string().max(200).optional(),
});

function asObject(payload: Json): Record<string, unknown> {
  if (payload && typeof payload === "object" && !Array.isArray(payload)) {
    return payload as Record<string, unknown>;
  }
  throw new PermanentJobError("INVALID_PAYLOAD", "Payload WhatsApp status inválido.");
}

/** Delivery/read/failed callbacks for outbound mock messages. */
export const handleWhatsappStatusUpdated: JobHandler = async ({
  admin,
  job,
  payload,
}): Promise<JobHandlerResult> => {
  const parsed = whatsappStatusUpdatedPayloadSchema.safeParse(asObject(payload));
  if (!parsed.success) {
    throw new PermanentJobError("INVALID_PAYLOAD", "Payload whatsapp.status.updated.mock inválido.");
  }
  if (!job.store_id) {
    throw new PermanentJobError("MISSING_STORE", "store_id requerido.");
  }

  const data = parsed.data;
  if (data.status === "failed" && data.retryable) {
    throw new RetryableJobError("WHATSAPP_TRANSIENT", data.error_message ?? "Fallo reintentable mock.");
  }

  const msg = await admin
    .from("whatsapp_messages")
    .select("id, status")
    .eq("store_id", job.store_id)
    .eq("external_message_id", data.external_message_id)
    .maybeSingle();
  if (!msg.data) {
    throw new PermanentJobError("NOT_FOUND", "Mensaje WhatsApp no encontrado.");
  }

  const now = new Date().toISOString();
  const patch: {
    status: string;
    delivered_at?: string;
    read_at?: string;
    error_code?: string;
    error_message?: string;
  } = { status: data.status };
  if (data.status === "delivered") patch.delivered_at = now;
  if (data.status === "read") {
    patch.read_at = now;
    patch.delivered_at = now;
  }
  if (data.status === "failed") {
    patch.error_code = data.error_code ?? "MOCK_FAIL";
    patch.error_message = data.error_message ?? "Fallo permanente mock";
  }

  await admin.from("whatsapp_messages").update(patch).eq("id", msg.data.id);

  return {
    ok: true,
    action: "updated",
    entityType: "whatsapp_message",
    entityId: msg.data.id,
    detail: data.status,
  };
};

export const whatsappInboundConfirmPayloadSchema = z.object({
  phone: z.string().min(5).max(40),
  external_message_id: z.string().min(1).max(200),
  body: z.string().max(4000),
  conversation_id: z.string().uuid().optional(),
  demo_seed: z.string().max(200).optional(),
});

/**
 * Extends inbound handling: after message insert, optionally update confirmation
 * and fire order.confirmed automation (does NOT touch payment/delivery).
 */
export async function applyInboundConfirmationEffects(
  admin: Parameters<JobHandler>[0]["admin"],
  input: {
    agencyId: string;
    storeId: string;
    conversationId: string;
    body: string;
  },
): Promise<{ confirmation: string | null }> {
  const inferred = inferConfirmationFromBody(input.body);
  if (!inferred || inferred === "pending") {
    return { confirmation: null };
  }

  const conv = await admin
    .from("whatsapp_conversations")
    .select("id, order_id, confirmation_status")
    .eq("id", input.conversationId)
    .eq("store_id", input.storeId)
    .single();
  if (!conv.data) return { confirmation: null };

  if (conv.data.confirmation_status === "confirmed" || conv.data.confirmation_status === "rejected") {
    return { confirmation: conv.data.confirmation_status };
  }

  await admin
    .from("whatsapp_conversations")
    .update({
      confirmation_status: inferred,
      updated_at: new Date().toISOString(),
    })
    .eq("id", input.conversationId);

  if (conv.data.order_id) {
    const order = await admin
      .from("orders")
      .select("id, confirmation_status")
      .eq("id", conv.data.order_id)
      .eq("store_id", input.storeId)
      .maybeSingle();

    if (
      order.data &&
      (order.data.confirmation_status === "confirmed" ||
        order.data.confirmation_status === "rejected")
    ) {
      return { confirmation: inferred };
    }

    await admin
      .from("orders")
      .update({
        confirmation_status: inferred,
        confirmed_at: inferred === "confirmed" ? new Date().toISOString() : null,
        ...(inferred === "confirmed" ? { order_status: "confirmed" as const } : {}),
        ...(inferred === "rejected" ? { order_status: "cancelled" as const } : {}),
      })
      .eq("id", conv.data.order_id)
      .eq("store_id", input.storeId);

    if (inferred === "confirmed") {
      await runAutomationsForTrigger({
        admin,
        trigger: "order.confirmed",
        agencyId: input.agencyId,
        storeId: input.storeId,
        ctx: {
          orderId: conv.data.order_id,
          confirmationStatus: "confirmed",
          source: "whatsapp",
        },
        entityType: "order",
        entityId: conv.data.order_id,
      });
    }
  }

  return { confirmation: inferred };
}
