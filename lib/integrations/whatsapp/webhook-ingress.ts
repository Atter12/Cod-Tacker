import "server-only";

import { resolveWhatsAppCredentialsFromIntegration } from "@/lib/integrations/whatsapp/credentials";
import { getWhatsAppEnv } from "@/lib/integrations/whatsapp/env";
import { mapWhatsAppWebhookPayload } from "@/lib/integrations/whatsapp/map-webhook";
import {
  allowWhatsAppOpenWebhookAuth,
  verifyWhatsAppWebhookSignature,
} from "@/lib/integrations/whatsapp/webhook-auth";
import { enqueueRawEventAndJob } from "@/lib/jobs/enqueue";
import { logger } from "@/lib/observability/logger";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Json } from "@/types/database.generated";

type ResolvedStore = {
  agencyId: string;
  storeId: string;
  integrationId: string;
};

async function resolveStoreByPhoneNumberId(
  admin: ReturnType<typeof createAdminClient>,
  phoneNumberId: string | null,
): Promise<ResolvedStore | null> {
  if (!phoneNumberId) return null;

  const byExternal = await admin
    .from("integrations")
    .select("id, agency_id, store_id, settings, metadata, secret_reference, external_account_id")
    .eq("provider", "whatsapp")
    .eq("external_account_id", phoneNumberId)
    .in("status", ["connected", "pending", "degraded", "error"])
    .order("updated_at", { ascending: false })
    .limit(5);

  for (const row of byExternal.data ?? []) {
    if (row.store_id) {
      return { agencyId: row.agency_id, storeId: row.store_id, integrationId: row.id };
    }
  }

  const connected = await admin
    .from("integrations")
    .select("id, agency_id, store_id, settings, metadata, secret_reference, external_account_id")
    .eq("provider", "whatsapp")
    .in("status", ["connected", "pending", "degraded", "error"])
    .order("updated_at", { ascending: false })
    .limit(40);

  for (const row of connected.data ?? []) {
    if (!row.store_id) continue;
    const creds = resolveWhatsAppCredentialsFromIntegration(row);
    if (creds?.phoneNumberId === phoneNumberId) {
      return { agencyId: row.agency_id, storeId: row.store_id, integrationId: row.id };
    }
  }

  return null;
}

/**
 * WhatsApp Cloud API webhook ingress.
 * Auth: X-Hub-Signature-256 with WHATSAPP_APP_SECRET (required in Production).
 * Never logs raw body / message text (PII).
 */
export async function handleWhatsAppWebhookIngress(input: {
  rawBody: string;
  signatureHeader: string | null;
}): Promise<{ status: number; body: Record<string, unknown>; enqueued?: boolean }> {
  const env = getWhatsAppEnv();
  const auth = verifyWhatsAppWebhookSignature({
    rawBody: input.rawBody,
    appSecret: env.appSecret,
    signatureHeader: input.signatureHeader,
    allowOpenWhenSecretUnset: allowWhatsAppOpenWebhookAuth(),
  });

  if (!auth.ok) {
    logger.warn("whatsapp.webhook.rejected", {
      status: auth.status,
      error: auth.error,
      vercel_env: process.env.VERCEL_ENV ?? null,
      secret_configured: Boolean(env.appSecret),
    });
    return { status: auth.status, body: { error: auth.error } };
  }
  if (auth.open) {
    logger.warn("whatsapp.webhook.auth_open", {
      message:
        "WHATSAPP_APP_SECRET unset — accepting webhook without signature (Preview/dev only; Production requires secret)",
      vercel_env: process.env.VERCEL_ENV ?? null,
    });
  }

  let json: unknown;
  try {
    json = input.rawBody.trim() ? (JSON.parse(input.rawBody) as unknown) : {};
  } catch {
    return { status: 400, body: { error: "JSON inválido" } };
  }

  const mapped = mapWhatsAppWebhookPayload(json);
  if (!mapped.ok) {
    if (mapped.error === "payload_not_object" || mapped.error === "unexpected_object") {
      return {
        status: 200,
        enqueued: false,
        body: { ok: true, enqueued: false, probe: true },
      };
    }
    return { status: 400, body: { error: mapped.error } };
  }

  if (mapped.events.length === 0) {
    return {
      status: 200,
      enqueued: false,
      body: { ok: true, enqueued: false, events: 0 },
    };
  }

  const admin = createAdminClient();
  const resolved = await resolveStoreByPhoneNumberId(admin, mapped.phoneNumberId);
  if (!resolved) {
    logger.warn("whatsapp.webhook.store_unresolved", {
      phone_number_id_suffix: mapped.phoneNumberId?.slice(-4) ?? null,
      event_count: mapped.events.length,
    });
    return {
      status: 200,
      enqueued: false,
      body: {
        ok: true,
        enqueued: false,
        unresolved: true,
        message: "No connected whatsapp integration for phone_number_id",
      },
    };
  }

  let enqueued = 0;
  for (const event of mapped.events) {
    if (event.kind === "inbound") {
      const result = await enqueueRawEventAndJob(admin, {
        agencyId: resolved.agencyId,
        storeId: resolved.storeId,
        integrationId: resolved.integrationId,
        provider: "whatsapp",
        eventType: "whatsapp.message.received",
        jobType: "whatsapp.message.received",
        idempotencyKey: `wa-in:${event.externalMessageId}`,
        correlationId: event.externalMessageId,
        payload: {
          phone: event.phone,
          external_message_id: event.externalMessageId,
          body: event.body,
          message_type: event.messageType,
          mode: "live",
        } as Json,
      });
      if (result.jobId) enqueued += 1;
    } else {
      const result = await enqueueRawEventAndJob(admin, {
        agencyId: resolved.agencyId,
        storeId: resolved.storeId,
        integrationId: resolved.integrationId,
        provider: "whatsapp",
        eventType: "whatsapp.status.updated",
        jobType: "whatsapp.status.updated",
        idempotencyKey: `wa-st:${event.externalMessageId}:${event.status}`,
        correlationId: event.externalMessageId,
        payload: {
          external_message_id: event.externalMessageId,
          status: event.status,
          error_code: event.errorCode,
          error_message: event.errorMessage,
          retryable: event.retryable,
          mode: "live",
        } as Json,
      });
      if (result.jobId) enqueued += 1;
    }
  }

  logger.info("whatsapp.webhook.enqueued", {
    store_id: resolved.storeId,
    events: mapped.events.length,
    enqueued,
    kinds: mapped.events.map((e) => e.kind),
  });

  return {
    status: 200,
    enqueued: enqueued > 0,
    body: { ok: true, enqueued, events: mapped.events.length },
  };
}
