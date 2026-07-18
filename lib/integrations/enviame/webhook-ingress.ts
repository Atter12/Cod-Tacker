import "server-only";

import {
  ENVIAME_MISSING_WEBHOOK_SECRET_ERROR,
  getEnviameEnv,
} from "@/lib/integrations/enviame/env";
import { mapEnviameWebhookToJobPayload } from "@/lib/integrations/enviame/map-webhook";
import { enqueueRawEventAndJob } from "@/lib/jobs/enqueue";
import { logger } from "@/lib/observability/logger";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Json } from "@/types/database.generated";

/**
 * Verify shared secret, map payload, resolve store, enqueue carrier.shipment.updated.
 * Does not call Enviame tracking API (no blocking poll on the HTTP request).
 */
export async function handleEnviameWebhookIngress(input: {
  rawBody: string;
  secretHeader: string | null;
  authorizationHeader: string | null;
  storeIdHeader: string | null;
}): Promise<{ status: number; body: Record<string, unknown>; enqueued?: boolean }> {
  const env = getEnviameEnv();
  if (!env.webhookSecret) {
    logger.warn("enviame.webhook.misconfigured", { error: ENVIAME_MISSING_WEBHOOK_SECRET_ERROR });
    return {
      status: 503,
      body: {
        error: ENVIAME_MISSING_WEBHOOK_SECRET_ERROR,
        required_env: ["ENVIAME_WEBHOOK_SECRET"],
      },
    };
  }

  const provided =
    input.secretHeader?.trim() ||
    bearerToken(input.authorizationHeader) ||
    null;
  if (!provided || provided !== env.webhookSecret) {
    return { status: 401, body: { error: "Webhook secret inválido" } };
  }

  let json: unknown;
  try {
    json = JSON.parse(input.rawBody) as unknown;
  } catch {
    return { status: 400, body: { error: "JSON inválido" } };
  }

  const mapped = mapEnviameWebhookToJobPayload(json);
  if (!mapped.ok) {
    return { status: 400, body: { error: mapped.error } };
  }

  const admin = createAdminClient();
  const resolved = await resolveStoreForEnviameWebhook(admin, {
    storeIdHint: input.storeIdHeader?.trim() || env.defaultStoreId,
    trackingNumber: mapped.payload.tracking_number,
    importedId: mapped.payload.order_external_id ?? null,
  });

  if (!resolved) {
    logger.warn("enviame.webhook.store_unresolved", {
      tracking_number: mapped.payload.tracking_number,
      imported_id: mapped.payload.order_external_id ?? null,
    });
    return {
      status: 404,
      body: {
        error:
          "Tienda no resuelta: define ENVIAME_DEFAULT_STORE_ID, header x-codtracked-store-id, o un shipment/order existente con ese tracking/imported_id",
      },
    };
  }

  const idempotencyKey = `enviame:wh:${mapped.payload.external_event_id}`;
  const enqueued = await enqueueRawEventAndJob(admin, {
    agencyId: resolved.agencyId,
    storeId: resolved.storeId,
    provider: "enviame",
    integrationId: resolved.integrationId,
    eventType: "carrier.shipment.updated",
    jobType: "carrier.shipment.updated",
    idempotencyKey,
    externalEventId: mapped.payload.external_event_id,
    payload: mapped.payload as unknown as Json,
  });

  logger.info("enviame.webhook.enqueued", {
    store_id: resolved.storeId,
    job_id: enqueued.jobId,
    created: enqueued.created,
    tracking_number: mapped.payload.tracking_number,
    external_status_code: mapped.payload.external_status_code,
    endpoint: "POST /api/integrations/enviame/webhooks",
  });

  return {
    status: 200,
    enqueued: true,
    body: {
      ok: true,
      jobId: enqueued.jobId,
      rawEventId: enqueued.rawEventId,
      created: enqueued.created,
      tracking_number: mapped.payload.tracking_number,
      external_status_code: mapped.payload.external_status_code,
    },
  };
}

function bearerToken(header: string | null): string | null {
  if (!header) return null;
  const m = /^Bearer\s+(.+)$/i.exec(header.trim());
  return m?.[1]?.trim() || null;
}

async function resolveStoreForEnviameWebhook(
  admin: ReturnType<typeof createAdminClient>,
  input: {
    storeIdHint: string | null;
    trackingNumber: string;
    importedId: string | null;
  },
): Promise<{ agencyId: string; storeId: string; integrationId: string | null } | null> {
  if (input.storeIdHint) {
    const store = await admin
      .from("stores")
      .select("id, agency_id")
      .eq("id", input.storeIdHint)
      .maybeSingle();
    if (store.data) {
      const integrationId = await findEnviameIntegrationId(
        admin,
        store.data.agency_id,
        store.data.id,
      );
      return {
        agencyId: store.data.agency_id,
        storeId: store.data.id,
        integrationId,
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
      integrationId: await findEnviameIntegrationId(admin, row.agency_id, row.store_id),
    };
  }

  if (input.importedId) {
    const byOrder = await admin
      .from("orders")
      .select("store_id, agency_id")
      .eq("external_order_id", input.importedId)
      .limit(2);
    if (!byOrder.error && byOrder.data && byOrder.data.length === 1) {
      const row = byOrder.data[0]!;
      return {
        agencyId: row.agency_id,
        storeId: row.store_id,
        integrationId: await findEnviameIntegrationId(admin, row.agency_id, row.store_id),
      };
    }
  }

  return null;
}

async function findEnviameIntegrationId(
  admin: ReturnType<typeof createAdminClient>,
  agencyId: string,
  storeId: string,
): Promise<string | null> {
  const result = await admin
    .from("integrations")
    .select("id")
    .eq("agency_id", agencyId)
    .eq("store_id", storeId)
    .eq("provider", "enviame")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return result.data?.id ?? null;
}
