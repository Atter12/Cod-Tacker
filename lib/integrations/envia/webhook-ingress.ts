import "server-only";

import { getEnviaEnv } from "@/lib/integrations/envia/env";
import { mapEnviaWebhookToJobPayload } from "@/lib/integrations/envia/map-webhook";
import { verifyEnviaWebhookAuth } from "@/lib/integrations/envia/webhook-auth";
import { enqueueRawEventAndJob } from "@/lib/jobs/enqueue";
import { logger } from "@/lib/observability/logger";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Json } from "@/types/database.generated";

/**
 * Envia.com webhook ingress.
 * Auth (when ENVIA_WEBHOOK_SECRET is set): Bearer or X-Webhook-Signature.
 * When secret unset: accept (UI Probar) + warn — set secret in production.
 */
export async function handleEnviaWebhookIngress(input: {
  rawBody: string;
  authorizationHeader: string | null;
  signatureHeader: string | null;
  timestampHeader: string | null;
  eventHeader: string | null;
  webhookIdHeader: string | null;
  storeIdHeader: string | null;
}): Promise<{ status: number; body: Record<string, unknown>; enqueued?: boolean }> {
  const env = getEnviaEnv();
  const authOk = verifyEnviaWebhookAuth({
    rawBody: input.rawBody,
    webhookSecret: env.webhookSecret,
    apiToken: env.apiToken,
    authorizationHeader: input.authorizationHeader,
    signatureHeader: input.signatureHeader,
    timestampHeader: input.timestampHeader,
    eventHeader: input.eventHeader,
  });

  if (!authOk.ok) {
    return { status: authOk.status, body: { error: authOk.error } };
  }
  if (authOk.open) {
    logger.warn("envia.webhook.auth_open", {
      message: "ENVIA_WEBHOOK_SECRET unset — accepting webhook without signature (set for production)",
    });
  }

  let json: unknown;
  try {
    json = input.rawBody.trim() ? (JSON.parse(input.rawBody) as unknown) : {};
  } catch {
    return { status: 400, body: { error: "JSON inválido" } };
  }

  const mapped = mapEnviaWebhookToJobPayload(json, {
    webhookId: input.webhookIdHeader,
    event: input.eventHeader,
  });
  if (!mapped.ok) {
    // Envia UI "Probar" often sends an empty/`{}` ping without tracking.
    // Ack 200 so connection tests succeed; real events always include tracking.
    if (mapped.error === "missing_tracking_number" || mapped.error === "payload_not_object") {
      logger.info("envia.webhook.probe_ack", {
        error: mapped.error,
        endpoint: "POST /api/integrations/envia/webhooks",
      });
      return {
        status: 200,
        enqueued: false,
        body: {
          ok: true,
          enqueued: false,
          probe: true,
          message: "Webhook reachable. Send a payload with tracking_number/status to enqueue.",
        },
      };
    }
    return { status: 400, body: { error: mapped.error } };
  }

  const admin = createAdminClient();
  const resolved = await resolveStoreForEnviaWebhook(admin, {
    storeIdHint: input.storeIdHeader?.trim() || env.defaultStoreId,
    trackingNumber: mapped.payload.tracking_number,
    orderExternalId: mapped.payload.order_external_id ?? null,
  });

  if (!resolved) {
    logger.warn("envia.webhook.store_unresolved", {
      tracking_number: mapped.payload.tracking_number,
      hint: "Set ENVIA_DEFAULT_STORE_ID or header x-codtracked-store-id",
    });
    return {
      status: 200,
      enqueued: false,
      body: {
        ok: true,
        enqueued: false,
        warning:
          "Tienda no resuelta: define ENVIA_DEFAULT_STORE_ID o header x-codtracked-store-id, o un shipment/order con ese tracking",
        tracking_number: mapped.payload.tracking_number,
        external_status_code: mapped.payload.external_status_code,
      },
    };
  }

  const idempotencyKey = `envia:wh:${mapped.payload.external_event_id}`;
  const enqueued = await enqueueRawEventAndJob(admin, {
    agencyId: resolved.agencyId,
    storeId: resolved.storeId,
    provider: "envia_com",
    integrationId: resolved.integrationId,
    eventType: "carrier.shipment.updated",
    jobType: "carrier.shipment.updated",
    idempotencyKey,
    externalEventId: mapped.payload.external_event_id,
    payload: mapped.payload as unknown as Json,
  });

  logger.info("envia.webhook.enqueued", {
    store_id: resolved.storeId,
    job_id: enqueued.jobId,
    created: enqueued.created,
    tracking_number: mapped.payload.tracking_number,
    external_status_code: mapped.payload.external_status_code,
    endpoint: "POST /api/integrations/envia/webhooks",
  });

  return {
    status: 200,
    enqueued: true,
    body: {
      ok: true,
      enqueued: true,
      jobId: enqueued.jobId,
      rawEventId: enqueued.rawEventId,
      created: enqueued.created,
      tracking_number: mapped.payload.tracking_number,
      external_status_code: mapped.payload.external_status_code,
    },
  };
}

async function resolveStoreForEnviaWebhook(
  admin: ReturnType<typeof createAdminClient>,
  input: {
    storeIdHint: string | null;
    trackingNumber: string;
    orderExternalId: string | null;
  },
): Promise<{ agencyId: string; storeId: string; integrationId: string | null } | null> {
  if (input.storeIdHint) {
    const store = await admin
      .from("stores")
      .select("id, agency_id")
      .eq("id", input.storeIdHint)
      .maybeSingle();
    if (store.data) {
      return {
        agencyId: store.data.agency_id,
        storeId: store.data.id,
        integrationId: await findEnviaIntegrationId(admin, store.data.agency_id, store.data.id),
      };
    }
  }

  const byTracking = await admin
    .from("shipments")
    .select("store_id, agency_id")
    .eq("tracking_number", input.trackingNumber)
    .limit(2);
  if (!byTracking.error && byTracking.data && byTracking.data.length === 1) {
    const row = byTracking.data[0]!;
    return {
      agencyId: row.agency_id,
      storeId: row.store_id,
      integrationId: await findEnviaIntegrationId(admin, row.agency_id, row.store_id),
    };
  }

  if (input.orderExternalId) {
    const byOrder = await admin
      .from("orders")
      .select("store_id, agency_id")
      .eq("external_order_id", input.orderExternalId)
      .limit(2);
    if (!byOrder.error && byOrder.data && byOrder.data.length === 1) {
      const row = byOrder.data[0]!;
      return {
        agencyId: row.agency_id,
        storeId: row.store_id,
        integrationId: await findEnviaIntegrationId(admin, row.agency_id, row.store_id),
      };
    }
  }

  return null;
}

async function findEnviaIntegrationId(
  admin: ReturnType<typeof createAdminClient>,
  agencyId: string,
  storeId: string,
): Promise<string | null> {
  const result = await admin
    .from("integrations")
    .select("id")
    .eq("agency_id", agencyId)
    .eq("store_id", storeId)
    .eq("provider", "envia_com")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return result.data?.id ?? null;
}
