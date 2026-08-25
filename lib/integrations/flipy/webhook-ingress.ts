import "server-only";

import {
  readFlipyTiendaId,
  readFlipyWebhookSecretRef,
  unpackFlipyWebhookSecret,
} from "@/lib/integrations/flipy/credentials";
import { mapFlipyWebhookToJobPayload } from "@/lib/integrations/flipy/map-webhook";
import { verifyFlipyWebhookSignature } from "@/lib/integrations/flipy/webhook-auth";
import { enqueueRawEventAndJob } from "@/lib/jobs/enqueue";
import { logger } from "@/lib/observability/logger";
import { createAdminClient } from "@/lib/supabase/admin";
import { isEncryptedSecretRef } from "@/lib/crypto/secret-box";
import type { Json } from "@/types/database.generated";

type ResolvedStore = {
  agencyId: string;
  storeId: string;
  integrationId: string;
};

export async function handleFlipyWebhookIngress(input: {
  rawBody: string;
  signatureHeader: string | null;
  eventIdHeader: string | null;
  agencySlug: string;
  storeSlug: string;
}): Promise<{ status: number; body: Record<string, unknown>; enqueued?: boolean }> {
  const admin = createAdminClient();
  const resolved = await resolveStoreForFlipyWebhook(admin, input.agencySlug, input.storeSlug);
  if (!resolved) {
    return { status: 404, body: { error: "Tienda o integración Flipy no encontrada" } };
  }

  const integration = await admin
    .from("integrations")
    .select("id, settings, secret_reference, status")
    .eq("id", resolved.integrationId)
    .maybeSingle();
  if (!integration.data || integration.data.status === "disconnected") {
    return { status: 404, body: { error: "Integración Flipy desconectada" } };
  }

  const secretRef = readFlipyWebhookSecretRef(integration.data.settings);
  let webhookSecret: string | null = null;
  if (secretRef && isEncryptedSecretRef(secretRef)) {
    try {
      webhookSecret = unpackFlipyWebhookSecret(secretRef);
    } catch {
      webhookSecret = null;
    }
  }

  if (!webhookSecret) {
    logger.warn("flipy.webhook.missing_secret", { store_id: resolved.storeId });
    return {
      status: 401,
      body: { error: "Webhook secret Flipy no configurado en la integración" },
    };
  }

  if (!verifyFlipyWebhookSignature(input.rawBody, input.signatureHeader, webhookSecret)) {
    return { status: 401, body: { error: "Firma X-Flipy-Signature inválida" } };
  }

  let json: unknown;
  try {
    json = input.rawBody.trim() ? (JSON.parse(input.rawBody) as unknown) : {};
  } catch {
    return { status: 400, body: { error: "JSON inválido" } };
  }

  const mapped = mapFlipyWebhookToJobPayload(json, { eventId: input.eventIdHeader });
  if (!mapped.ok) {
    if (mapped.error === "missing_tracking_number" || mapped.error === "payload_not_object") {
      return {
        status: 200,
        enqueued: false,
        body: {
          ok: true,
          enqueued: false,
          probe: true,
          message: "Webhook Flipy reachable. Envía estado + tracking para enqueue.",
        },
      };
    }
    return { status: 400, body: { error: mapped.error } };
  }

  const idempotencyKey = `flipy:wh:${mapped.payload.external_event_id}`;
  const enqueued = await enqueueRawEventAndJob(admin, {
    agencyId: resolved.agencyId,
    storeId: resolved.storeId,
    provider: "flipy",
    integrationId: resolved.integrationId,
    eventType: "carrier.shipment.updated",
    jobType: "carrier.shipment.updated",
    idempotencyKey,
    externalEventId: mapped.payload.external_event_id,
    payload: mapped.payload as unknown as Json,
  });

  logger.info("flipy.webhook.enqueued", {
    store_id: resolved.storeId,
    job_id: enqueued.jobId,
    created: enqueued.created,
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
      tracking_number: mapped.payload.tracking_number,
      external_status_code: mapped.payload.external_status_code,
    },
  };
}

async function resolveStoreForFlipyWebhook(
  admin: ReturnType<typeof createAdminClient>,
  agencySlug: string,
  storeSlug: string,
): Promise<ResolvedStore | null> {
  const agency = await admin.from("agencies").select("id").eq("slug", agencySlug).maybeSingle();
  if (!agency.data) return null;

  const store = await admin
    .from("stores")
    .select("id, agency_id")
    .eq("agency_id", agency.data.id)
    .eq("slug", storeSlug)
    .maybeSingle();
  if (!store.data) return null;

  const integration = await admin
    .from("integrations")
    .select("id")
    .eq("agency_id", store.data.agency_id)
    .eq("store_id", store.data.id)
    .eq("provider", "flipy")
    .in("status", ["connected", "degraded", "pending"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!integration.data) return null;

  return {
    agencyId: store.data.agency_id,
    storeId: store.data.id,
    integrationId: integration.data.id,
  };
}

export async function resolveFlipyIntegrationForStore(
  admin: ReturnType<typeof createAdminClient>,
  agencyId: string,
  storeId: string,
) {
  const integration = await admin
    .from("integrations")
    .select("*")
    .eq("agency_id", agencyId)
    .eq("store_id", storeId)
    .eq("provider", "flipy")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return integration.data;
}

export function readFlipyOriginFromSettings(settings: unknown): {
  address?: string;
  lat?: number;
  lng?: number;
  contactName?: string;
  phone?: string;
} {
  if (!settings || typeof settings !== "object" || Array.isArray(settings)) return {};
  const bag = settings as Record<string, unknown>;
  const address =
    typeof bag.origin_address === "string"
      ? bag.origin_address
      : typeof bag.originAddress === "string"
        ? bag.originAddress
        : undefined;
  const lat =
    typeof bag.origin_lat === "number"
      ? bag.origin_lat
      : typeof bag.originLat === "number"
        ? bag.originLat
        : undefined;
  const lng =
    typeof bag.origin_lng === "number"
      ? bag.origin_lng
      : typeof bag.originLng === "number"
        ? bag.originLng
        : undefined;
  const contactName =
    typeof bag.origin_contact === "string"
      ? bag.origin_contact
      : typeof bag.originContact === "string"
        ? bag.originContact
        : typeof bag.contact_name === "string"
          ? bag.contact_name
          : undefined;
  const phone =
    typeof bag.origin_phone === "string"
      ? bag.origin_phone
      : typeof bag.originPhone === "string"
        ? bag.originPhone
        : typeof bag.telefono === "string"
          ? bag.telefono
          : typeof bag.contact_phone === "string"
            ? bag.contact_phone
            : typeof bag.contactPhone === "string"
              ? bag.contactPhone
              : undefined;
  return { address, lat, lng, contactName, phone };
}

export function hasFlipyTiendaLinked(settings: unknown): boolean {
  return Boolean(readFlipyTiendaId(settings));
}
