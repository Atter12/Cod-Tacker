"use server";

import { revalidatePath } from "next/cache";
import { actionFail, actionOk, type ActionResult } from "@/lib/actions/action-result";
import { writeAuditLog } from "@/lib/audit/write-audit";
import { requireUser } from "@/lib/auth/require-user";
import { routes } from "@/config/routes";
import { ValidationError } from "@/lib/errors";
import { enqueueRawEventAndJob } from "@/lib/jobs/enqueue";
import {
  getIntegrationRuntimeMode,
  getMessagingProvider,
  resolveLiveWhatsAppCredentials,
} from "@/lib/integrations/registry";
import {
  extractTemplateVariables,
  renderTemplate,
  WHATSAPP_REPLY_SCENARIOS,
} from "@/lib/whatsapp/templates";
import type { Role } from "@/config/permissions";
import { can } from "@/lib/permissions/can";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { requireStoreAccess } from "@/lib/tenant/require-store-access";
import {
  getConversationById,
  getTemplateById,
} from "@/services/whatsapp.service";
import type { Json } from "@/types/database.generated";

export type WhatsappActionResult = ActionResult<{
  jobId?: string;
  conversationId?: string;
  templateId?: string;
  plaintextKey?: string;
}>;

function assertWhatsappManage(roles: readonly Role[]) {
  if (!can(roles, "whatsapp.manage")) {
    throw new ValidationError("No tienes permiso para gestionar WhatsApp.");
  }
}

function assertWhatsappOrOrdersManage(roles: readonly Role[]) {
  if (!can(roles, "whatsapp.manage") && !can(roles, "orders.manage")) {
    throw new ValidationError("No tienes permiso para solicitar confirmación WhatsApp.");
  }
}

function revalidateWa(agencySlug: string, storeSlug: string, conversationId?: string) {
  revalidatePath(routes.store.whatsapp(agencySlug, storeSlug));
  revalidatePath(routes.store.whatsappTemplates(agencySlug, storeSlug));
  if (conversationId) {
    revalidatePath(routes.store.whatsappConversation(agencySlug, storeSlug, conversationId));
  }
}

async function resolveWhatsappIntegration(storeId: string) {
  const client = await createClient();
  const res = await client
    .from("integrations")
    .select("id")
    .eq("store_id", storeId)
    .eq("provider", "whatsapp")
    .limit(1);
  return res.data?.[0]?.id ?? null;
}

export async function sendWhatsappMessage(
  agencySlug: string,
  storeSlug: string,
  conversationId: string,
  input: { body: string; templateId?: string; deliveryScenario?: string },
): Promise<WhatsappActionResult> {
  try {
    const user = await requireUser();
    const membership = await requireStoreAccess(agencySlug, storeSlug);
    assertWhatsappManage(membership.roles);
    if (!membership.storeId || !membership.agencyId) throw new ValidationError("Tienda inválida.");

    const client = await createClient();
    const conv = await getConversationById(client, membership.storeId, conversationId);
    if (!conv) throw new ValidationError("Conversación no encontrada.");

    let body = input.body.trim();
    let templateMetaName: string | null = null;
    let templateLanguage = "es";
    let bodyParameters: string[] | undefined;

    if (input.templateId) {
      const tpl = await getTemplateById(client, membership.storeId, input.templateId);
      if (!tpl) throw new ValidationError("Plantilla no encontrada.");
      templateMetaName = tpl.name.trim();
      templateLanguage = tpl.language || "es";
      const rendered = renderTemplate(tpl.body, {
        phone: conv.phone,
        order: conv.order_id?.slice(0, 8) ?? "",
      });
      body = rendered.text;
      const vars = extractTemplateVariables(tpl.body);
      if (vars.length) {
        bodyParameters = vars.map((key) => {
          if (key === "phone") return conv.phone;
          if (key === "order") return conv.order_id?.slice(0, 8) ?? "";
          return "";
        });
      }
    }

    if (!body && !templateMetaName) throw new ValidationError("Mensaje vacío.");

    const externalIdDefault = `out-${crypto.randomUUID()}`;
    const now = new Date().toISOString();
    const admin = createAdminClient();
    const integrationId = await resolveWhatsappIntegration(membership.storeId);
    const live = getIntegrationRuntimeMode() === "live";

    let externalId = externalIdDefault;
    let liveSend = false;

    if (live) {
      if (!integrationId) {
        throw new ValidationError(
          "WhatsApp no está conectado. Conéctalo en Integraciones antes de enviar.",
        );
      }
      const integration = await admin
        .from("integrations")
        .select("id, settings, metadata, secret_reference, external_account_id")
        .eq("id", integrationId)
        .maybeSingle();
      const creds = integration.data
        ? resolveLiveWhatsAppCredentials(integration.data)
        : null;
      if (!creds?.accessToken || !creds.phoneNumberId) {
        throw new ValidationError(
          "Faltan credenciales WhatsApp (token / phone_number_id). Reconecta en Integraciones.",
        );
      }
      const adapter = getMessagingProvider("whatsapp", creds);
      if (templateMetaName) {
        if (!adapter.sendTemplate) {
          throw new ValidationError("Adapter WhatsApp sin sendTemplate.");
        }
        const sent = await adapter.sendTemplate({
          to: conv.phone,
          templateName: templateMetaName,
          languageCode: templateLanguage,
          bodyParameters,
        });
        externalId = sent.externalId;
        body = body || `[template:${templateMetaName}]`;
      } else {
        if (!adapter.sendText) throw new ValidationError("Adapter WhatsApp sin sendText.");
        const sent = await adapter.sendText(conv.phone, body);
        externalId = sent.externalId;
      }
      liveSend = true;
    }

    const insert = await client
      .from("whatsapp_messages")
      .insert({
        agency_id: membership.agencyId,
        store_id: membership.storeId,
        conversation_id: conversationId,
        order_id: conv.order_id,
        direction: "outbound",
        message_type: input.templateId ? "template" : "text",
        status: "sent",
        body,
        external_message_id: externalId,
        sent_at: now,
        template_id: input.templateId ?? null,
        payload: {
          demo: !liveSend,
          mock: !liveSend,
          mode: liveSend ? "live" : "mock",
          template_name: templateMetaName,
        } as Json,
      })
      .select("id")
      .single();
    if (insert.error || !insert.data) throw new ValidationError("No se pudo registrar el mensaje.");

    await client
      .from("whatsapp_conversations")
      .update({
        last_message_at: now,
        last_message_preview: body.slice(0, 120),
        unread_count: 0,
      })
      .eq("id", conversationId);

    // Delivery scenarios only in mock mode (live statuses come from Meta webhooks).
    if (!liveSend) {
      const scenario = input.deliveryScenario ?? "delivered_read";

      if (scenario === "delivered_read") {
        await enqueueRawEventAndJob(admin, {
          agencyId: membership.agencyId,
          storeId: membership.storeId,
          integrationId,
          provider: "whatsapp",
          eventType: "whatsapp.status.updated.mock",
          jobType: "whatsapp.status.updated.mock",
          idempotencyKey: `wa-status:${externalId}:delivered`,
          correlationId: crypto.randomUUID(),
          payload: {
            external_message_id: externalId,
            status: "delivered",
            demo_seed: externalId,
          } as Json,
        });
        await enqueueRawEventAndJob(admin, {
          agencyId: membership.agencyId,
          storeId: membership.storeId,
          integrationId,
          provider: "whatsapp",
          eventType: "whatsapp.status.updated.mock",
          jobType: "whatsapp.status.updated.mock",
          idempotencyKey: `wa-status:${externalId}:read`,
          correlationId: crypto.randomUUID(),
          payload: {
            external_message_id: externalId,
            status: "read",
            demo_seed: `${externalId}-read`,
          } as Json,
        });
      } else if (scenario === "failed_retryable") {
        await enqueueRawEventAndJob(admin, {
          agencyId: membership.agencyId,
          storeId: membership.storeId,
          integrationId,
          provider: "whatsapp",
          eventType: "whatsapp.status.updated.mock",
          jobType: "whatsapp.status.updated.mock",
          idempotencyKey: `wa-status:${externalId}:fail-r`,
          correlationId: crypto.randomUUID(),
          payload: {
            external_message_id: externalId,
            status: "failed",
            retryable: true,
            error_message: "Transient mock failure",
          } as Json,
        });
      } else if (scenario === "failed_permanent") {
        await enqueueRawEventAndJob(admin, {
          agencyId: membership.agencyId,
          storeId: membership.storeId,
          integrationId,
          provider: "whatsapp",
          eventType: "whatsapp.status.updated.mock",
          jobType: "whatsapp.status.updated.mock",
          idempotencyKey: `wa-status:${externalId}:fail-p`,
          correlationId: crypto.randomUUID(),
          payload: {
            external_message_id: externalId,
            status: "failed",
            retryable: false,
            error_code: "MOCK_PERM",
            error_message: "Permanent mock failure",
          } as Json,
        });
      }
    }

    await writeAuditLog({
      action: "whatsapp_message_sent",
      entityType: "whatsapp_message",
      entityId: insert.data.id,
      actorId: user.id,
      agencyId: membership.agencyId,
      storeId: membership.storeId,
      newData: { conversationId, live: liveSend, template: templateMetaName },
    });

    revalidateWa(agencySlug, storeSlug, conversationId);
    return actionOk({ conversationId });
  } catch (error) {
    return actionFail(error);
  }
}

/** @deprecated Use sendWhatsappMessage — kept for any leftover imports. */
export const sendMockWhatsappMessage = sendWhatsappMessage;

export async function simulateWhatsappReply(
  agencySlug: string,
  storeSlug: string,
  conversationId: string,
  scenarioId: string,
): Promise<WhatsappActionResult> {
  try {
    const user = await requireUser();
    const membership = await requireStoreAccess(agencySlug, storeSlug);
    assertWhatsappManage(membership.roles);
    if (!membership.storeId || !membership.agencyId) throw new ValidationError("Tienda inválida.");

    if (getIntegrationRuntimeMode() === "live") {
      throw new ValidationError(
        "La simulación de respuestas solo está disponible en modo mock. En live usa el webhook de Meta.",
      );
    }

    const client = await createClient();
    const conv = await getConversationById(client, membership.storeId, conversationId);
    if (!conv) throw new ValidationError("Conversación no encontrada.");

    const scenario = WHATSAPP_REPLY_SCENARIOS.find((s) => s.id === scenarioId);
    if (!scenario) throw new ValidationError("Escenario inválido.");

    if (scenarioId === "no_response") {
      await client
        .from("whatsapp_conversations")
        .update({
          confirmation_status: "expired",
          metadata: {
            ...(typeof conv.metadata === "object" && conv.metadata && !Array.isArray(conv.metadata)
              ? (conv.metadata as object)
              : {}),
            no_response: true,
          } as Json,
        })
        .eq("id", conversationId);
      await writeAuditLog({
        action: "whatsapp_reply_simulated",
        entityType: "whatsapp_conversation",
        entityId: conversationId,
        actorId: user.id,
        agencyId: membership.agencyId,
        storeId: membership.storeId,
        newData: { scenarioId },
      });
      revalidateWa(agencySlug, storeSlug, conversationId);
      return actionOk({ conversationId });
    }

    const admin = createAdminClient();
    const integrationId = await resolveWhatsappIntegration(membership.storeId);
    const externalId = `in-${crypto.randomUUID()}`;
    const enqueued = await enqueueRawEventAndJob(admin, {
      agencyId: membership.agencyId,
      storeId: membership.storeId,
      integrationId,
      provider: "whatsapp",
      eventType: "whatsapp.message.received.mock",
      jobType: "whatsapp.message.received.mock",
      idempotencyKey: `wa-in:${externalId}`,
      correlationId: crypto.randomUUID(),
      payload: {
        phone: conv.phone,
        external_message_id: externalId,
        body: scenario.body,
        demo_seed: externalId,
      } as Json,
    });

    await writeAuditLog({
      action: "whatsapp_reply_simulated",
      entityType: "whatsapp_conversation",
      entityId: conversationId,
      actorId: user.id,
      agencyId: membership.agencyId,
      storeId: membership.storeId,
      newData: { scenarioId, jobId: enqueued.jobId },
    });

    revalidateWa(agencySlug, storeSlug, conversationId);
    return actionOk({ conversationId, jobId: enqueued.jobId });
  } catch (error) {
    return actionFail(error);
  }
}

export async function setWhatsappConfirmation(
  agencySlug: string,
  storeSlug: string,
  conversationId: string,
  status: "confirmed" | "rejected",
): Promise<WhatsappActionResult> {
  try {
    const user = await requireUser();
    const membership = await requireStoreAccess(agencySlug, storeSlug);
    assertWhatsappManage(membership.roles);
    if (!membership.storeId) throw new ValidationError("Tienda inválida.");

    const client = await createClient();
    const conv = await getConversationById(client, membership.storeId, conversationId);
    if (!conv) throw new ValidationError("Conversación no encontrada.");

    await client
      .from("whatsapp_conversations")
      .update({ confirmation_status: status, updated_at: new Date().toISOString() })
      .eq("id", conversationId)
      .eq("store_id", membership.storeId);

    if (conv.order_id) {
      await client
        .from("orders")
        .update({
          confirmation_status: status,
          confirmed_at: status === "confirmed" ? new Date().toISOString() : null,
          order_status: status === "confirmed" ? "confirmed" : "cancelled",
        })
        .eq("id", conv.order_id)
        .eq("store_id", membership.storeId);
    }

    await writeAuditLog({
      action: status === "confirmed" ? "whatsapp_order_confirmed" : "whatsapp_order_rejected",
      entityType: "whatsapp_conversation",
      entityId: conversationId,
      actorId: user.id,
      agencyId: membership.agencyId,
      storeId: membership.storeId,
      newData: { orderId: conv.order_id, status },
    });

    revalidateWa(agencySlug, storeSlug, conversationId);
    return actionOk({ conversationId });
  } catch (error) {
    return actionFail(error);
  }
}

export async function closeWhatsappConversation(
  agencySlug: string,
  storeSlug: string,
  conversationId: string,
): Promise<WhatsappActionResult> {
  try {
    const user = await requireUser();
    const membership = await requireStoreAccess(agencySlug, storeSlug);
    assertWhatsappManage(membership.roles);
    if (!membership.storeId) throw new ValidationError("Tienda inválida.");

    const client = await createClient();
    await client
      .from("whatsapp_conversations")
      .update({ closed_at: new Date().toISOString(), unread_count: 0 })
      .eq("id", conversationId)
      .eq("store_id", membership.storeId);

    await writeAuditLog({
      action: "whatsapp_conversation_closed",
      entityType: "whatsapp_conversation",
      entityId: conversationId,
      actorId: user.id,
      agencyId: membership.agencyId,
      storeId: membership.storeId,
    });

    revalidateWa(agencySlug, storeSlug, conversationId);
    return actionOk({ conversationId });
  } catch (error) {
    return actionFail(error);
  }
}

export async function createWhatsappTemplate(
  agencySlug: string,
  storeSlug: string,
  input: { name: string; body: string; language?: string; category?: string },
): Promise<WhatsappActionResult> {
  try {
    const user = await requireUser();
    const membership = await requireStoreAccess(agencySlug, storeSlug);
    assertWhatsappManage(membership.roles);
    if (!membership.storeId || !membership.agencyId) throw new ValidationError("Tienda inválida.");

    const vars = extractTemplateVariables(input.body);
    const live = getIntegrationRuntimeMode() === "live";
    const client = await createClient();
    const insert = await client
      .from("whatsapp_templates")
      .insert({
        agency_id: membership.agencyId,
        store_id: membership.storeId,
        name: input.name.trim(),
        body: input.body,
        language: input.language ?? "es",
        category: input.category ?? "utility",
        variables: vars as unknown as Json,
        status: "draft",
        is_active: false,
        created_by: user.id,
        metadata: (live
          ? {
              mode: "live",
              note: "El name debe coincidir con la plantilla aprobada en Meta Business Manager",
            }
          : { demo: true, mock_approval: true, mode: "mock" }) as Json,
      })
      .select("id")
      .single();
    if (insert.error || !insert.data) throw new ValidationError("No se pudo crear la plantilla.");

    await writeAuditLog({
      action: "whatsapp_template_created",
      entityType: "whatsapp_template",
      entityId: insert.data.id,
      actorId: user.id,
      agencyId: membership.agencyId,
      storeId: membership.storeId,
    });

    revalidateWa(agencySlug, storeSlug);
    return actionOk({ templateId: insert.data.id });
  } catch (error) {
    return actionFail(error);
  }
}

export async function updateWhatsappTemplate(
  agencySlug: string,
  storeSlug: string,
  templateId: string,
  input: { body?: string; status?: string; isActive?: boolean; name?: string },
): Promise<WhatsappActionResult> {
  try {
    const user = await requireUser();
    const membership = await requireStoreAccess(agencySlug, storeSlug);
    assertWhatsappManage(membership.roles);
    if (!membership.storeId) throw new ValidationError("Tienda inválida.");

    const patch: {
      updated_at: string;
      body?: string;
      variables?: Json;
      name?: string;
      status?: string;
      is_active?: boolean;
    } = { updated_at: new Date().toISOString() };
    if (input.body != null) {
      patch.body = input.body;
      patch.variables = extractTemplateVariables(input.body) as unknown as Json;
    }
    if (input.name != null) patch.name = input.name;
    if (input.status != null) {
      // Local catalog only — Meta approval is managed in Business Manager.
      // "approved" here means "ready to send via Cloud API with matching Meta name".
      patch.status = input.status;
    }
    if (input.isActive != null) patch.is_active = input.isActive;

    const client = await createClient();
    await client
      .from("whatsapp_templates")
      .update(patch)
      .eq("id", templateId)
      .eq("store_id", membership.storeId);

    await writeAuditLog({
      action: "whatsapp_template_updated",
      entityType: "whatsapp_template",
      entityId: templateId,
      actorId: user.id,
      agencyId: membership.agencyId,
      storeId: membership.storeId,
      newData: input,
    });

    revalidateWa(agencySlug, storeSlug);
    return actionOk({ templateId });
  } catch (error) {
    return actionFail(error);
  }
}

export async function duplicateWhatsappTemplate(
  agencySlug: string,
  storeSlug: string,
  templateId: string,
): Promise<WhatsappActionResult> {
  try {
    const user = await requireUser();
    const membership = await requireStoreAccess(agencySlug, storeSlug);
    assertWhatsappManage(membership.roles);
    if (!membership.storeId || !membership.agencyId) throw new ValidationError("Tienda inválida.");

    const client = await createClient();
    const tpl = await getTemplateById(client, membership.storeId, templateId);
    if (!tpl) throw new ValidationError("Plantilla no encontrada.");

    const insert = await client
      .from("whatsapp_templates")
      .insert({
        agency_id: membership.agencyId,
        store_id: membership.storeId,
        name: `${tpl.name} (copia)`,
        body: tpl.body,
        language: tpl.language,
        category: tpl.category,
        variables: tpl.variables,
        status: "draft",
        is_active: false,
        created_by: user.id,
        metadata: {
          demo: getIntegrationRuntimeMode() !== "live",
          mode: getIntegrationRuntimeMode(),
          duplicated_from: templateId,
        } as Json,
      })
      .select("id")
      .single();
    if (!insert.data) throw new ValidationError("No se pudo duplicar.");

    await writeAuditLog({
      action: "whatsapp_template_duplicated",
      entityType: "whatsapp_template",
      entityId: insert.data.id,
      actorId: user.id,
      agencyId: membership.agencyId,
      storeId: membership.storeId,
    });

    revalidateWa(agencySlug, storeSlug);
    return actionOk({ templateId: insert.data.id });
  } catch (error) {
    return actionFail(error);
  }
}

/**
 * Manually enqueue COD WhatsApp confirmation for an order (cash_expected).
 * Uses a fresh idempotency key so soft-skipped / stuck creates can be retried.
 */
export async function requestWhatsappCodConfirmation(
  agencySlug: string,
  storeSlug: string,
  orderId: string,
): Promise<WhatsappActionResult> {
  try {
    const user = await requireUser();
    const membership = await requireStoreAccess(agencySlug, storeSlug);
    assertWhatsappOrOrdersManage(membership.roles);
    if (!membership.storeId || !membership.agencyId) {
      throw new ValidationError("Tienda inválida.");
    }

    const client = await createClient();
    const order = await client
      .from("orders")
      .select("id, payment_status, confirmation_status")
      .eq("id", orderId)
      .eq("store_id", membership.storeId)
      .maybeSingle();
    if (!order.data) throw new ValidationError("Pedido no encontrado.");
    if (order.data.payment_status !== "cash_expected") {
      throw new ValidationError(
        "Solo pedidos COD (cash_expected) pueden solicitar confirmación WhatsApp.",
      );
    }
    if (
      order.data.confirmation_status === "confirmed" ||
      order.data.confirmation_status === "rejected"
    ) {
      throw new ValidationError("La confirmación del pedido ya está cerrada.");
    }

    const waIntegrationId = await resolveWhatsappIntegration(membership.storeId);
    if (!waIntegrationId) {
      throw new ValidationError("WhatsApp no está conectado en esta tienda.");
    }

    const { createAdminClient } = await import("@/lib/supabase/admin");
    const { enqueueWhatsappCodConfirmationRequest } = await import(
      "@/lib/integrations/whatsapp/enqueue-confirmation"
    );
    const admin = createAdminClient();
    const enqueued = await enqueueWhatsappCodConfirmationRequest({
      admin,
      agencyId: membership.agencyId,
      storeId: membership.storeId,
      orderId,
      source: "manual",
      integrationId: waIntegrationId,
      allowPendingResend: true,
      actorId: user.id,
      kick: true,
    });
    if (!enqueued || enqueued.skipped) {
      throw new ValidationError(
        enqueued?.skipped
          ? `No se pudo encolar confirmación WhatsApp (${enqueued.skipped}).`
          : "No se pudo encolar confirmación WhatsApp.",
      );
    }

    await writeAuditLog({
      action: "whatsapp_confirmation_requested",
      entityType: "order",
      entityId: orderId,
      actorId: user.id,
      agencyId: membership.agencyId,
      storeId: membership.storeId,
      newData: { jobId: enqueued.jobId, created: enqueued.created, source: "manual" },
    });

    revalidatePath(routes.store.orderDetail(agencySlug, storeSlug, orderId));
    revalidateWa(agencySlug, storeSlug);
    return actionOk({ jobId: enqueued.jobId });
  } catch (error) {
    return actionFail(error);
  }
}
