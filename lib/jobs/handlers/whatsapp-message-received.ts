import { z } from "zod";
import { PermanentJobError } from "@/lib/jobs/errors";
import type { JobHandler, JobHandlerResult, JobsAdminClient } from "@/lib/jobs/types";
import type { Json } from "@/types/database.generated";

export const whatsappMessageReceivedPayloadSchema = z.object({
  phone: z.string().min(5).max(40),
  external_message_id: z.string().min(1).max(200),
  body: z.string().max(4000).optional(),
  message_type: z.string().max(40).optional(),
  order_id: z.string().uuid().optional(),
  demo_seed: z.string().min(1).max(200).optional(),
  mode: z.enum(["live", "mock"]).optional(),
});

function asObject(payload: Json): Record<string, unknown> {
  if (payload && typeof payload === "object" && !Array.isArray(payload)) {
    return payload as Record<string, unknown>;
  }
  throw new PermanentJobError("INVALID_PAYLOAD", "El payload de WhatsApp no es un objeto válido.");
}

async function ensureConversation(
  admin: JobsAdminClient,
  input: {
    agencyId: string;
    storeId: string;
    integrationId: string | null;
    phone: string;
    orderId?: string | null;
    live?: boolean;
  },
): Promise<string> {
  const existing = await admin
    .from("whatsapp_conversations")
    .select("id, order_id")
    .eq("store_id", input.storeId)
    .eq("phone", input.phone)
    .maybeSingle();
  if (existing.data) {
    if (input.orderId && !existing.data.order_id) {
      await admin
        .from("whatsapp_conversations")
        .update({ order_id: input.orderId, updated_at: new Date().toISOString() })
        .eq("id", existing.data.id)
        .eq("store_id", input.storeId);
    }
    return existing.data.id;
  }

  if (!input.integrationId) {
    throw new PermanentJobError(
      "MISSING_INTEGRATION",
      "Se requiere integration_id para crear una conversación WhatsApp.",
    );
  }

  const created = await admin
    .from("whatsapp_conversations")
    .insert({
      agency_id: input.agencyId,
      store_id: input.storeId,
      integration_id: input.integrationId,
      phone: input.phone,
      order_id: input.orderId ?? null,
      confirmation_status: "pending",
      metadata: { demo: !input.live, mode: input.live ? "live" : "mock" } as Json,
    })
    .select("id")
    .single();
  if (created.error || !created.data) {
    throw new PermanentJobError("DATABASE_ERROR", "No se pudo crear la conversación WhatsApp.");
  }
  return created.data.id;
}

export const handleWhatsappMessageReceived: JobHandler = async ({
  admin,
  job,
  payload,
}): Promise<JobHandlerResult> => {
  const parsed = whatsappMessageReceivedPayloadSchema.safeParse(asObject(payload));
  if (!parsed.success) {
    throw new PermanentJobError(
      "INVALID_PAYLOAD",
      "Payload de whatsapp.message.received inválido.",
    );
  }
  if (!job.store_id) {
    throw new PermanentJobError("MISSING_STORE", "El trabajo de WhatsApp requiere store_id.");
  }

  const data = parsed.data;
  const live = data.mode === "live";
  const phoneNormalized = data.phone.startsWith("+")
    ? data.phone
    : `+${data.phone.replace(/\D/g, "")}`;

  const existingMsg = await admin
    .from("whatsapp_messages")
    .select("id")
    .eq("store_id", job.store_id)
    .eq("external_message_id", data.external_message_id)
    .maybeSingle();
  if (existingMsg.data) {
    return {
      ok: true,
      action: "skipped",
      entityType: "whatsapp_message",
      entityId: existingMsg.data.id,
      detail: "duplicate_external_message_id",
    };
  }

  const conversationId = await ensureConversation(admin, {
    agencyId: job.agency_id,
    storeId: job.store_id,
    integrationId: job.integration_id,
    phone: phoneNormalized,
    orderId: data.order_id ?? null,
    live,
  });

  const insert = await admin
    .from("whatsapp_messages")
    .insert({
      agency_id: job.agency_id,
      store_id: job.store_id,
      conversation_id: conversationId,
      order_id: data.order_id ?? null,
      direction: "inbound",
      message_type: data.message_type ?? "text",
      status: "received",
      body: data.body ?? null,
      external_message_id: data.external_message_id,
      received_at: new Date().toISOString(),
      payload: {
        demo: !live,
        demo_seed: data.demo_seed ?? null,
        job_id: job.id,
        mode: live ? "live" : "mock",
      } as Json,
    })
    .select("id")
    .single();
  if (insert.error || !insert.data) {
    if (insert.error?.code === "23505") {
      const again = await admin
        .from("whatsapp_messages")
        .select("id")
        .eq("store_id", job.store_id)
        .eq("external_message_id", data.external_message_id)
        .maybeSingle();
      if (again.data) {
        return {
          ok: true,
          action: "skipped",
          entityType: "whatsapp_message",
          entityId: again.data.id,
          detail: "race_duplicate",
        };
      }
    }
    throw new PermanentJobError("DATABASE_ERROR", "No se pudo registrar el mensaje WhatsApp.");
  }

  await admin
    .from("whatsapp_conversations")
    .update({
      last_message_at: new Date().toISOString(),
      last_message_preview: (data.body ?? "").slice(0, 120),
      unread_count: 1,
    })
    .eq("id", conversationId)
    .eq("store_id", job.store_id);

  const { applyInboundConfirmationEffects } = await import(
    "@/lib/jobs/handlers/whatsapp-status-updated"
  );
  await applyInboundConfirmationEffects(admin, {
    agencyId: job.agency_id,
    storeId: job.store_id,
    conversationId,
    body: data.body ?? "",
  });

  return {
    ok: true,
    action: "created",
    entityType: "whatsapp_message",
    entityId: insert.data.id,
  };
};
