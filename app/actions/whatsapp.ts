"use server";

import { revalidatePath } from "next/cache";
import { actionFail, actionOk, type ActionResult } from "@/lib/actions/action-result";
import { writeAuditLog } from "@/lib/audit/write-audit";
import { requireUser } from "@/lib/auth/require-user";
import { routes } from "@/config/routes";
import { ValidationError } from "@/lib/errors";
import { enqueueRawEventAndJob } from "@/lib/jobs/enqueue";
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

export async function sendMockWhatsappMessage(
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
    if (!body) throw new ValidationError("Mensaje vacío.");

    if (input.templateId) {
      const tpl = await getTemplateById(client, membership.storeId, input.templateId);
      if (!tpl) throw new ValidationError("Plantilla no encontrada.");
      const rendered = renderTemplate(tpl.body, {
        phone: conv.phone,
        order: conv.order_id?.slice(0, 8) ?? "",
      });
      body = rendered.text;
    }

    const externalId = `out-${crypto.randomUUID()}`;
    const now = new Date().toISOString();
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
        payload: { demo: true, mock: true } as Json,
      })
      .select("id")
      .single();
    if (insert.error || !insert.data) throw new ValidationError("No se pudo enviar el mensaje mock.");

    await client
      .from("whatsapp_conversations")
      .update({
        last_message_at: now,
        last_message_preview: body.slice(0, 120),
        unread_count: 0,
      })
      .eq("id", conversationId);

    // Enqueue delivery callback scenario via jobs
    const scenario = input.deliveryScenario ?? "delivered_read";
    const admin = createAdminClient();
    const integrationId = await resolveWhatsappIntegration(membership.storeId);

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
        payload: { external_message_id: externalId, status: "delivered", demo_seed: externalId } as Json,
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
        payload: { external_message_id: externalId, status: "read", demo_seed: `${externalId}-read` } as Json,
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

    await writeAuditLog({
      action: "whatsapp_message_sent",
      entityType: "whatsapp_message",
      entityId: insert.data.id,
      actorId: user.id,
      agencyId: membership.agencyId,
      storeId: membership.storeId,
      newData: { conversationId, scenario },
    });

    revalidateWa(agencySlug, storeSlug, conversationId);
    return actionOk({ conversationId });
  } catch (error) {
    return actionFail(error);
  }
}

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
        metadata: { demo: true, mock_approval: true } as Json,
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
    if (input.status != null) patch.status = input.status;
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
        metadata: { demo: true, duplicated_from: templateId } as Json,
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
