import { z } from "zod";
import { PermanentJobError, RetryableJobError } from "@/lib/jobs/errors";
import type { JobHandler, JobHandlerResult, JobsAdminClient } from "@/lib/jobs/types";
import { normalizeWhatsAppPhone } from "@/lib/integrations/whatsapp/phone";
import type { Json } from "@/types/database.generated";

export const whatsappConfirmationRequestPayloadSchema = z.object({
  order_id: z.string().uuid(),
  demo_seed: z.string().max(200).optional(),
});

function asObject(payload: Json): Record<string, unknown> {
  if (payload && typeof payload === "object" && !Array.isArray(payload)) {
    return payload as Record<string, unknown>;
  }
  throw new PermanentJobError("INVALID_PAYLOAD", "Payload WhatsApp confirmation inválido.");
}

async function findWhatsAppIntegration(
  admin: JobsAdminClient,
  agencyId: string,
  storeId: string,
) {
  const result = await admin
    .from("integrations")
    .select("id, settings, metadata, secret_reference, external_account_id, status")
    .eq("agency_id", agencyId)
    .eq("store_id", storeId)
    .eq("provider", "whatsapp")
    .in("status", ["connected", "pending", "degraded", "error"])
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return result.data;
}

/**
 * COD semantics: link order ↔ conversation and send confirmation template (live)
 * or skip send when no template configured.
 *
 * Live Graph/send deps are dynamic-imported so unit tests can load this handler
 * without pulling `server-only` modules at import time.
 */
export const handleWhatsappConfirmationRequest: JobHandler = async ({
  admin,
  job,
  payload,
}): Promise<JobHandlerResult> => {
  const parsed = whatsappConfirmationRequestPayloadSchema.safeParse(asObject(payload));
  if (!parsed.success) {
    throw new PermanentJobError("INVALID_PAYLOAD", "Payload whatsapp.confirmation.request inválido.");
  }
  if (!job.store_id) {
    throw new PermanentJobError("MISSING_STORE", "store_id requerido.");
  }

  const orderId = parsed.data.order_id;
  const order = await admin
    .from("orders")
    .select("id, order_number, confirmation_status, payment_status, shipping_country_code, customer_id")
    .eq("id", orderId)
    .eq("store_id", job.store_id)
    .maybeSingle();
  if (!order.data) {
    throw new PermanentJobError("NOT_FOUND", "Pedido no encontrado para confirmación WhatsApp.");
  }

  if (
    order.data.confirmation_status === "confirmed" ||
    order.data.confirmation_status === "rejected"
  ) {
    return {
      ok: true,
      action: "skipped",
      entityType: "order",
      entityId: orderId,
      detail: "already_terminal_confirmation",
    };
  }

  const integration = await findWhatsAppIntegration(admin, job.agency_id, job.store_id);
  if (!integration) {
    return {
      ok: true,
      action: "skipped",
      entityType: "order",
      entityId: orderId,
      detail: "whatsapp_not_connected",
    };
  }

  const { resolveOrderCustomerContact } = await import("@/lib/conversions/resolve-order-contact");
  const contact = await resolveOrderCustomerContact(admin, job.store_id, orderId);
  const phoneDigits = contact.phone
    ? normalizeWhatsAppPhone(contact.phone, contact.countryCode ?? order.data.shipping_country_code)
    : "";
  if (!phoneDigits) {
    return {
      ok: true,
      action: "skipped",
      entityType: "order",
      entityId: orderId,
      detail: "missing_phone",
    };
  }

  const phoneStored = `+${phoneDigits}`;
  let conversationId: string | null = null;

  const existingByOrder = await admin
    .from("whatsapp_conversations")
    .select("id, phone")
    .eq("store_id", job.store_id)
    .eq("order_id", orderId)
    .maybeSingle();
  if (existingByOrder.data) {
    conversationId = existingByOrder.data.id;
  } else {
    const existingByPhone = await admin
      .from("whatsapp_conversations")
      .select("id, order_id")
      .eq("store_id", job.store_id)
      .eq("phone", phoneStored)
      .maybeSingle();
    if (existingByPhone.data) {
      conversationId = existingByPhone.data.id;
      if (!existingByPhone.data.order_id) {
        await admin
          .from("whatsapp_conversations")
          .update({ order_id: orderId, updated_at: new Date().toISOString() })
          .eq("id", conversationId)
          .eq("store_id", job.store_id);
      }
    } else {
      const created = await admin
        .from("whatsapp_conversations")
        .insert({
          agency_id: job.agency_id,
          store_id: job.store_id,
          integration_id: integration.id,
          order_id: orderId,
          phone: phoneStored,
          confirmation_status: "pending",
          metadata: { source: "confirmation_request" } as Json,
        })
        .select("id")
        .single();
      if (created.error || !created.data) {
        throw new PermanentJobError("DATABASE_ERROR", "No se pudo crear conversación WhatsApp.");
      }
      conversationId = created.data.id;
    }
  }

  await admin
    .from("orders")
    .update({
      confirmation_status: "pending",
      updated_at: new Date().toISOString(),
    })
    .eq("id", orderId)
    .eq("store_id", job.store_id);

  const { getIntegrationRuntimeMode, getMessagingProvider, resolveLiveWhatsAppCredentials } =
    await import("@/lib/integrations/registry");
  const live = getIntegrationRuntimeMode() === "live";
  const creds = live ? resolveLiveWhatsAppCredentials(integration) : null;
  const templateName = creds?.confirmationTemplateName ?? null;

  if (!live || !creds) {
    return {
      ok: true,
      action: "updated",
      entityType: "whatsapp_conversation",
      entityId: conversationId,
      detail: "linked_no_live_send",
    };
  }

  if (!templateName) {
    return {
      ok: true,
      action: "updated",
      entityType: "whatsapp_conversation",
      entityId: conversationId,
      detail: "linked_missing_confirmation_template",
    };
  }

  try {
    const adapter = getMessagingProvider("whatsapp", creds);
    if (!adapter.sendTemplate) {
      throw new PermanentJobError("NOT_SUPPORTED", "Adapter sin sendTemplate.");
    }
    // Meta sample "order confirmation" templates often expect 3 body vars:
    // {{1}} customer name, {{2}} order number, {{3}} date.
    let customerName = "Cliente";
    if (order.data.customer_id) {
      const customer = await admin
        .from("customers")
        .select("full_name")
        .eq("id", order.data.customer_id)
        .eq("store_id", job.store_id)
        .maybeSingle();
      const full = customer.data?.full_name?.trim();
      if (full) customerName = full;
    }
    const orderLabel = order.data.order_number ?? orderId.slice(0, 8);
    const dateLabel = new Date().toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
    const sent = await adapter.sendTemplate({
      to: phoneDigits,
      templateName,
      languageCode: creds.confirmationTemplateLanguage || "es",
      bodyParameters: [customerName, orderLabel, dateLabel],
    });

    const now = new Date().toISOString();
    await admin.from("whatsapp_messages").insert({
      agency_id: job.agency_id,
      store_id: job.store_id,
      conversation_id: conversationId,
      order_id: orderId,
      direction: "outbound",
      message_type: "template",
      status: "sent",
      body: `template:${templateName}`,
      external_message_id: sent.externalId,
      sent_at: now,
      payload: {
        mode: "live",
        template: templateName,
        job_id: job.id,
      } as Json,
    });

    await admin
      .from("whatsapp_conversations")
      .update({
        last_message_at: now,
        last_message_preview: `Plantilla ${templateName}`.slice(0, 120),
        confirmation_status: "pending",
        unread_count: 0,
      })
      .eq("id", conversationId);

    return {
      ok: true,
      action: "created",
      entityType: "whatsapp_message",
      entityId: conversationId,
      detail: "confirmation_template_sent",
    };
  } catch (error) {
    if (error instanceof PermanentJobError || error instanceof RetryableJobError) throw error;
    const message = error instanceof Error ? error.message : "WhatsApp send failed";
    const retryable = /rate|temporar|try again|130429|131048/i.test(message);
    if (retryable) {
      throw new RetryableJobError("WHATSAPP_SEND_RETRY", message.slice(0, 240));
    }
    throw new PermanentJobError("WHATSAPP_SEND_FAILED", message.slice(0, 240));
  }
};
