import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { describe, it } from "node:test";
import { verifyShopifyWebhookHmac } from "@/lib/integrations/shopify/hmac";
import { mapRestOrderToCreatedPayload } from "@/lib/integrations/shopify/map-order";
import { buildShopifyCreatedOrderInsert } from "@/lib/integrations/shopify/created-order-row";
import {
  shopifyOrderWebhookIdempotencyKey,
  shopifyOrderWebhookJobType,
} from "@/lib/integrations/shopify/webhook-job";
import { shopifyOrderCreatedPayloadSchema } from "@/lib/jobs/handlers/shopify-order-payload";
import { getJobHandler, listRegisteredJobTypes } from "@/lib/jobs/handlers/registry";
import { PermanentJobError } from "@/lib/jobs/errors";
import { decideJobFailureOutcome } from "@/lib/jobs/failure-outcome";
import { handleShopifyOrderCreated } from "@/lib/jobs/handlers/shopify-order-created";
import type { BackgroundJobRow } from "@/types/database";

const SECRET = "shopify-cross-secret";
const SHOP = "demo.myshopify.com";

function sign(body: string): string {
  return createHmac("sha256", SECRET).update(body).digest("base64");
}

function fakeJob(): BackgroundJobRow {
  return {
    id: "00000000-0000-4000-8000-000000000010",
    agency_id: "agency-acme",
    store_id: "store-acme",
    raw_event_id: null,
    integration_id: null,
    queue: "default",
    job_type: "shopify.order.created",
    status: "processing",
    priority: 100,
    payload: {},
    idempotency_key: "cross-entrada-plataforma",
    attempts: 1,
    max_attempts: 8,
    run_at: new Date().toISOString(),
    locked_at: null,
    locked_by: null,
    started_at: null,
    finished_at: null,
    last_error_code: null,
    last_error_message: null,
    correlation_id: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
}

/**
 * Strategic cross 1 — Entrada → Plataforma.
 * A signed Shopify order becomes one store-scoped create job. The same webhook
 * does not enqueue a second job. A broken payload dead-letters instead of
 * showing a partial order.
 */
describe("strategic · entrada → plataforma", () => {
  it("turns a signed order webhook into one order visible in that store", () => {
    const body = JSON.stringify({
      id: 1001,
      name: "#1001",
      currency: "PEN",
      total_price: "149.90",
      financial_status: "pending",
      tags: "COD",
    });
    assert.equal(verifyShopifyWebhookHmac(body, sign(body), SECRET), true);

    const mapped = mapRestOrderToCreatedPayload(JSON.parse(body));
    const parsed = shopifyOrderCreatedPayloadSchema.parse(mapped);
    const jobType = shopifyOrderWebhookJobType("orders/create");
    assert.equal(jobType, "shopify.order.created");
    assert.equal(listRegisteredJobTypes().includes(jobType), true);
    assert.equal(getJobHandler(jobType), handleShopifyOrderCreated);

    const row = buildShopifyCreatedOrderInsert({
      agencyId: "agency-acme",
      storeId: "store-acme",
      jobId: "job-1",
      customerId: null,
      now: "2026-10-09T15:00:00.000Z",
      live: true,
      data: parsed,
    });
    assert.equal(row.store_id, "store-acme");
    assert.equal(row.agency_id, "agency-acme");
    assert.notEqual(row.store_id, "store-other");
    assert.equal(row.external_order_id, "1001");
    assert.equal(row.order_number, "1001");
    assert.equal(row.payment_status, "cash_expected");
    assert.equal(row.source_name, "shopify");
  });

  it("keeps a repeated webhook on the same job key", () => {
    const first = shopifyOrderWebhookIdempotencyKey({
      shop: SHOP,
      topic: "orders/create",
      webhookId: "wh-1",
      externalOrderId: "1001",
      occurredAt: null,
    });
    const again = shopifyOrderWebhookIdempotencyKey({
      shop: SHOP,
      topic: "orders/create",
      webhookId: "wh-1",
      externalOrderId: "1001",
      occurredAt: "2026-10-09T15:00:00.000Z",
    });
    assert.equal(again, first);
    assert.notEqual(
      shopifyOrderWebhookIdempotencyKey({
        shop: SHOP,
        topic: "orders/create",
        webhookId: "wh-2",
        externalOrderId: "1001",
        occurredAt: null,
      }),
      first,
    );
  });

  it("dead-letters a webhook body that is not an order", async () => {
    await assert.rejects(
      () =>
        handleShopifyOrderCreated({
          admin: {} as never,
          job: fakeJob(),
          payload: ["not-an-order"] as never,
        }),
      (err: unknown) => err instanceof PermanentJobError,
    );
    assert.equal(
      decideJobFailureOutcome({ permanent: true, attempts: 1, maxAttempts: 8 }),
      "dead_letter",
    );
  });
});
