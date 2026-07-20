import "server-only";

import {
  fingerprintEnviaApiToken,
} from "@/lib/integrations/envia/token-fingerprint";
import { getEnviaEnv } from "@/lib/integrations/envia/env";
import { mapEnviaWebhookToJobPayload } from "@/lib/integrations/envia/map-webhook";
import { verifyEnviaWebhookAuth } from "@/lib/integrations/envia/webhook-auth";
import { enqueueRawEventAndJob } from "@/lib/jobs/enqueue";
import { logger } from "@/lib/observability/logger";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Json } from "@/types/database.generated";

type ResolvedStore = {
  agencyId: string;
  storeId: string;
  integrationId: string | null;
  via: "path_slug" | "tracking" | "order" | "bearer_token" | "store_hint";
};

/**
 * Envia.com webhook ingress (hybrid tenant resolve).
 *
 * Order: path slug → tracking → order → Bearer API-token fingerprint → demo store hint.
 * Auth: Bearer secret or X-Webhook-Signature HMAC when ENVIA_WEBHOOK_SECRET is set.
 * S15: Production rejects when secret is unset (401). Preview may accept open for Probar.
 */
export async function handleEnviaWebhookIngress(input: {
  rawBody: string;
  authorizationHeader: string | null;
  signatureHeader: string | null;
  timestampHeader: string | null;
  eventHeader: string | null;
  webhookIdHeader: string | null;
  storeIdHeader: string | null;
  agencySlug?: string | null;
  storeSlug?: string | null;
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
    logger.warn("envia.webhook.rejected", {
      status: authOk.status,
      error: authOk.error,
      vercel_env: process.env.VERCEL_ENV ?? null,
      secret_configured: Boolean(env.webhookSecret),
    });
    return { status: authOk.status, body: { error: authOk.error } };
  }
  if (authOk.open) {
    logger.warn("envia.webhook.auth_open", {
      message:
        "ENVIA_WEBHOOK_SECRET unset — accepting webhook without signature (Preview/dev only; Production requires secret)",
      vercel_env: process.env.VERCEL_ENV ?? null,
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
    if (mapped.error === "missing_tracking_number" || mapped.error === "payload_not_object") {
      logger.debug("envia.webhook.probe_ack", {
        error: mapped.error,
        agency_slug: input.agencySlug ?? null,
        store_slug: input.storeSlug ?? null,
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
    agencySlug: input.agencySlug?.trim() || null,
    storeSlug: input.storeSlug?.trim() || null,
    storeIdHint: input.storeIdHeader?.trim() || env.defaultStoreId,
    trackingNumber: mapped.payload.tracking_number,
    orderExternalId: mapped.payload.order_external_id ?? null,
    authorizationHeader: input.authorizationHeader,
  });

  if (!resolved) {
    logger.warn("envia.webhook.store_unresolved", {
      tracking_number: mapped.payload.tracking_number,
      agency_slug: input.agencySlug ?? null,
      store_slug: input.storeSlug ?? null,
      hint: "Use /api/webhooks/envia/{agencySlug}/{storeSlug}, connect Envia token, or match shipment tracking",
    });
    return {
      status: 200,
      enqueued: false,
      body: {
        ok: true,
        enqueued: false,
        warning:
          "Tienda no resuelta: usa URL por slug, conecta el token Envia en Integraciones, o envía un tracking ya ligado a un shipment/order",
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
    via: resolved.via,
    tracking_number: mapped.payload.tracking_number,
    external_status_code: mapped.payload.external_status_code,
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
      via: resolved.via,
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

export async function resolveStoreForEnviaWebhook(
  admin: ReturnType<typeof createAdminClient>,
  input: {
    agencySlug: string | null;
    storeSlug: string | null;
    storeIdHint: string | null;
    trackingNumber: string;
    orderExternalId: string | null;
    authorizationHeader: string | null;
  },
): Promise<ResolvedStore | null> {
  if (input.agencySlug && input.storeSlug) {
    const byPath = await resolveByPathSlugs(admin, input.agencySlug, input.storeSlug);
    if (byPath) return { ...byPath, via: "path_slug" };
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
      via: "tracking",
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
        via: "order",
      };
    }
  }

  const bearer = bearerToken(input.authorizationHeader);
  if (bearer) {
    const byToken = await resolveByApiTokenFingerprint(admin, bearer);
    if (byToken === "ambiguous") {
      logger.warn("envia.webhook.store_ambiguous", {
        reason: "multiple_integrations_for_bearer_fingerprint",
      });
      return null;
    }
    if (byToken) return { ...byToken, via: "bearer_token" };
  }

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
        via: "store_hint",
      };
    }
  }

  return null;
}

async function resolveByPathSlugs(
  admin: ReturnType<typeof createAdminClient>,
  agencySlug: string,
  storeSlug: string,
): Promise<{ agencyId: string; storeId: string; integrationId: string | null } | null> {
  const agency = await admin
    .from("agencies")
    .select("id")
    .eq("slug", agencySlug)
    .maybeSingle();
  if (!agency.data) return null;

  const store = await admin
    .from("stores")
    .select("id, agency_id")
    .eq("agency_id", agency.data.id)
    .eq("slug", storeSlug)
    .maybeSingle();
  if (!store.data) return null;

  return {
    agencyId: store.data.agency_id,
    storeId: store.data.id,
    integrationId: await findEnviaIntegrationId(admin, store.data.agency_id, store.data.id),
  };
}

async function resolveByApiTokenFingerprint(
  admin: ReturnType<typeof createAdminClient>,
  apiToken: string,
): Promise<
  | { agencyId: string; storeId: string; integrationId: string | null }
  | "ambiguous"
  | null
> {
  const fingerprint = fingerprintEnviaApiToken(apiToken);
  const result = await admin
    .from("integrations")
    .select("id, agency_id, store_id, settings, status")
    .eq("provider", "envia_com")
    .in("status", ["connected", "degraded", "pending"])
    .filter("settings->>token_fingerprint", "eq", fingerprint)
    .limit(3);

  if (result.error || !result.data?.length) return null;

  const withStore = result.data.filter(
    (row): row is typeof row & { store_id: string } => typeof row.store_id === "string" && !!row.store_id,
  );
  if (withStore.length === 0) return null;
  if (withStore.length > 1) return "ambiguous";

  const row = withStore[0]!;
  return {
    agencyId: row.agency_id,
    storeId: row.store_id,
    integrationId: row.id,
  };
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
