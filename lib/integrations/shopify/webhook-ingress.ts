import "server-only";

import { decryptSecret, isEncryptedSecretRef } from "@/lib/crypto/secret-box";
import { enqueueRawEventAndJob } from "@/lib/jobs/enqueue";
import { enrichShopifyOrderAttribution } from "@/lib/integrations/shopify/enrich-order-attribution";
import { getShopifyEnv } from "@/lib/integrations/shopify/env";
import { verifyShopifyWebhookHmac } from "@/lib/integrations/shopify/hmac";
import { assertShopifyShopDomain } from "@/lib/integrations/shopify/domain";
import {
  mapRestOrderToCreatedPayload,
  mapRestOrderToUpdatedPayload,
  type ShopifyRestOrder,
} from "@/lib/integrations/shopify/map-order";
import { logger } from "@/lib/observability/logger";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Json } from "@/types/database.generated";

export type ShopifyWebhookHandled = {
  ok: true;
  skipped?: boolean;
  reason?: string;
  jobId?: string;
  rawEventId?: string;
};

/**
 * Verify HMAC, resolve tenant by shop domain, enqueue order job.
 * Returns 401-style failure as thrown Error with code, or handled result.
 */
export async function handleShopifyWebhookIngress(input: {
  rawBody: string;
  hmacHeader: string | null;
  shopHeader: string | null;
  topicHeader: string | null;
  webhookIdHeader: string | null;
}): Promise<{ status: number; body: Record<string, unknown> }> {
  const { clientSecret } = getShopifyEnv();
  if (!verifyShopifyWebhookHmac(input.rawBody, input.hmacHeader, clientSecret)) {
    return { status: 401, body: { error: "HMAC inválido" } };
  }

  let shop: string;
  try {
    shop = assertShopifyShopDomain(input.shopHeader ?? "");
  } catch {
    return { status: 400, body: { error: "Shop inválido" } };
  }

  const topic = (input.topicHeader ?? "").toLowerCase();
  if (topic !== "orders/create" && topic !== "orders/updated") {
    return { status: 200, body: { ok: true, skipped: true, reason: "topic_ignored" } };
  }

  let order: ShopifyRestOrder;
  try {
    order = JSON.parse(input.rawBody) as ShopifyRestOrder;
  } catch {
    return { status: 400, body: { error: "JSON inválido" } };
  }

  const admin = createAdminClient();
  const storeLookup = await admin
    .from("stores")
    .select("id, agency_id, shopify_shop_domain")
    .eq("shopify_shop_domain", shop)
    .limit(1)
    .maybeSingle();

  if (storeLookup.error || !storeLookup.data) {
    return { status: 404, body: { error: "Tienda no vinculada en CODTracked" } };
  }

  const store = storeLookup.data;
  const integrationLookup = await admin
    .from("integrations")
    .select("id, secret_reference, status")
    .eq("agency_id", store.agency_id)
    .eq("store_id", store.id)
    .eq("provider", "shopify")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (
    integrationLookup.error ||
    !integrationLookup.data ||
    integrationLookup.data.status === "disconnected" ||
    integrationLookup.data.status === "revoked"
  ) {
    return { status: 404, body: { error: "Integración Shopify no conectada" } };
  }

  if (!isEncryptedSecretRef(integrationLookup.data.secret_reference)) {
    return { status: 409, body: { error: "Falta credencial live cifrada" } };
  }

  const isCreate = topic === "orders/create";
  let payload = isCreate ? mapRestOrderToCreatedPayload(order) : mapRestOrderToUpdatedPayload(order);
  if (!payload.external_order_id) {
    return { status: 400, body: { error: "Pedido sin id" } };
  }

  let attributionEnriched = false;
  let journeyReady: boolean | null = null;
  // Near-realtime: if REST webhook lacks UTMs, pull GraphQL journey/attrs before enqueue.
  if (!payload.attribution?.has_attribution && isEncryptedSecretRef(integrationLookup.data.secret_reference)) {
    try {
      const accessToken = decryptSecret(integrationLookup.data.secret_reference);
      const enrich = await enrichShopifyOrderAttribution({
        shop,
        accessToken,
        externalOrderId: payload.external_order_id,
        current: payload.attribution,
        // Keep webhook under Shopify's ACK window; short single retry only.
        retryDelayMs: isCreate ? 1200 : 0,
      });
      attributionEnriched = enrich.enriched;
      journeyReady = enrich.journeyReady;
      if (enrich.enriched || enrich.attribution.landing_site || enrich.attribution.referring_site) {
        payload = { ...payload, attribution: enrich.attribution };
      }
    } catch (err) {
      logger.warn("shopify.webhook.attribution_enrich_failed", {
        shop,
        topic,
        external_order_id: payload.external_order_id,
        error: err instanceof Error ? err.message.slice(0, 300) : "enrich_failed",
      });
    }
  }

  const attributionDebug = {
    external_order_id: payload.external_order_id,
    raw_landing_site: order.landing_site ?? null,
    raw_referring_site: order.referring_site ?? null,
    raw_note_present: Boolean(order.note?.trim()),
    mapped_has_attribution: Boolean(payload.attribution?.has_attribution),
    mapped_landing_site: payload.attribution?.landing_site ?? null,
    mapped_utm_source: payload.attribution?.utm_source ?? null,
    mapped_fbclid: payload.attribution?.fbclid ?? null,
    attribution_enriched: attributionEnriched,
    journey_ready: journeyReady,
  };
  logger.info("shopify.webhook.attribution_debug", {
    shop,
    topic,
    ...attributionDebug,
  });

  const jobType = isCreate ? "shopify.order.created" : "shopify.order.updated";
  const webhookId = input.webhookIdHeader?.trim() || "";
  const idempotencyKey =
    webhookId.length > 0
      ? `shopify:wh:${shop}:${webhookId}`
      : `shopify:wh:${shop}:${topic}:${payload.external_order_id}:${order.updated_at ?? order.created_at ?? "na"}`;

  const enqueued = await enqueueRawEventAndJob(admin, {
    agencyId: store.agency_id,
    storeId: store.id,
    provider: "shopify",
    integrationId: integrationLookup.data.id,
    eventType: jobType,
    jobType,
    idempotencyKey,
    externalEventId: webhookId || `${topic}:${payload.external_order_id}`,
    payload: payload as unknown as Json,
  });

  return {
    status: 200,
    body: {
      ok: true,
      created: enqueued.created,
      jobId: enqueued.jobId,
      rawEventId: enqueued.rawEventId,
      attribution_debug: attributionDebug,
    },
  };
}
