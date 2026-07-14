import "server-only";

import { isEncryptedSecretRef } from "@/lib/crypto/secret-box";
import { enqueueRawEventAndJob } from "@/lib/jobs/enqueue";
import { getShopifyEnv } from "@/lib/integrations/shopify/env";
import { verifyShopifyWebhookHmac } from "@/lib/integrations/shopify/hmac";
import { assertShopifyShopDomain } from "@/lib/integrations/shopify/domain";
import {
  mapRestOrderToCreatedPayload,
  mapRestOrderToUpdatedPayload,
  type ShopifyRestOrder,
} from "@/lib/integrations/shopify/map-order";
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
  const payload = isCreate ? mapRestOrderToCreatedPayload(order) : mapRestOrderToUpdatedPayload(order);
  if (!payload.external_order_id) {
    return { status: 400, body: { error: "Pedido sin id" } };
  }

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
    },
  };
}
