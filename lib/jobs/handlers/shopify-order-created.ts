import { PermanentJobError } from "@/lib/jobs/errors";
import type { JobHandler, JobHandlerResult } from "@/lib/jobs/types";
import { shopifyOrderCreatedPayloadSchema } from "@/lib/jobs/handlers/shopify-order-payload";
import { syncShopifyOrderItems } from "@/lib/jobs/handlers/shopify-sync-order-items";
import { upsertShopifyCustomer } from "@/lib/jobs/handlers/shopify-upsert-customer";
import { upsertShopifyOrderAttribution } from "@/lib/jobs/handlers/shopify-upsert-attribution";
import type { Json } from "@/types/database.generated";

export { shopifyOrderCreatedPayloadSchema };

function asObject(payload: Json): Record<string, unknown> {
  if (payload && typeof payload === "object" && !Array.isArray(payload)) {
    return payload as Record<string, unknown>;
  }
  throw new PermanentJobError("INVALID_PAYLOAD", "El payload del pedido no es un objeto válido.");
}

export const handleShopifyOrderCreated: JobHandler = async ({
  admin,
  job,
  payload,
}): Promise<JobHandlerResult> => {
  const parsed = shopifyOrderCreatedPayloadSchema.safeParse(asObject(payload));
  if (!parsed.success) {
    throw new PermanentJobError("INVALID_PAYLOAD", "Payload de pedido Shopify inválido.");
  }
  if (!job.store_id) {
    throw new PermanentJobError("MISSING_STORE", "El trabajo de pedido requiere store_id.");
  }

  const data = parsed.data;
  const existing = await admin
    .from("orders")
    .select("id")
    .eq("store_id", job.store_id)
    .eq("external_order_id", data.external_order_id)
    .maybeSingle();
  if (existing.error) {
    throw new PermanentJobError("DATABASE_ERROR", "No se pudo consultar el pedido existente.");
  }
  if (existing.data) {
    // Create is idempotent, but later webhooks/sync may inject attribution (e.g. note)
    // that was missing on the first create — apply it on the existing row.
    // Also refresh money fields so shipping/subtotal stay aligned with Shopify.
    const amountPatch: {
      total_amount?: number;
      subtotal_amount?: number;
      shipping_amount?: number;
      customer_id?: string;
    } = {};
    if (typeof data.total_amount === "number") amountPatch.total_amount = data.total_amount;
    if (typeof data.subtotal_amount === "number") amountPatch.subtotal_amount = data.subtotal_amount;
    if (typeof data.shipping_amount === "number") amountPatch.shipping_amount = data.shipping_amount;

    if (data.customer) {
      const customerId = await upsertShopifyCustomer({
        admin,
        storeId: job.store_id,
        customer: data.customer,
      });
      if (customerId) amountPatch.customer_id = customerId;
    }

    if (Object.keys(amountPatch).length > 0) {
      await admin
        .from("orders")
        .update(amountPatch)
        .eq("id", existing.data.id)
        .eq("store_id", job.store_id);
    }
    if (data.line_items) {
      await syncShopifyOrderItems({
        admin,
        storeId: job.store_id,
        orderId: existing.data.id,
        lineItems: data.line_items,
      });
    }
    if (data.attribution) {
      await upsertShopifyOrderAttribution({
        admin,
        agencyId: job.agency_id,
        storeId: job.store_id,
        orderId: existing.data.id,
        attributedValue: data.total_amount,
        attribution: data.attribution,
      });
    }
    return {
      ok: true,
      action: "updated",
      entityType: "order",
      entityId: existing.data.id,
      detail: "duplicate_external_order_id",
    };
  }

  if (data.demo_seed) {
    const bySeed = await admin
      .from("orders")
      .select("id")
      .eq("store_id", job.store_id)
      .contains("metadata", { demo_seed: data.demo_seed })
      .maybeSingle();
    if (bySeed.data) {
      return {
        ok: true,
        action: "skipped",
        entityType: "order",
        entityId: bySeed.data.id,
        detail: "duplicate_demo_seed",
      };
    }
  }

  const customerId = data.customer
    ? await upsertShopifyCustomer({
        admin,
        storeId: job.store_id,
        customer: data.customer,
      })
    : null;

  const now = new Date().toISOString();
  const total = data.total_amount;
  const live = data.mode === "live" || job.job_type === "shopify.order.created";
  const shipping = data.shipping;
  const paymentStatus = data.payment_status ?? "cash_expected";
  const expectedCodAmount =
    data.expected_cod_amount !== undefined
      ? data.expected_cod_amount
      : paymentStatus === "cash_expected"
        ? total
        : null;
  const insert = await admin
    .from("orders")
    .insert({
      agency_id: job.agency_id,
      store_id: job.store_id,
      customer_id: customerId,
      external_order_id: data.external_order_id,
      order_number: data.order_number ?? data.external_order_id,
      created_at_source: now,
      currency_code: data.currency_code,
      subtotal_amount: data.subtotal_amount ?? Math.max(0, total - (data.shipping_amount ?? 0)),
      total_amount: total,
      shipping_amount: data.shipping_amount ?? 0,
      tax_amount: 0,
      discount_amount: 0,
      order_status: data.order_status ?? "created",
      confirmation_status: "not_requested",
      payment_status: paymentStatus,
      expected_cod_amount: expectedCodAmount,
      source_name: live ? "shopify" : "shopify.mock",
      ...(shipping?.country_code ? { shipping_country_code: shipping.country_code } : {}),
      ...(shipping?.region ? { shipping_region: shipping.region } : {}),
      ...(shipping?.city ? { shipping_city: shipping.city } : {}),
      ...(shipping?.district ? { shipping_district: shipping.district } : {}),
      ...(shipping?.postal_code ? { shipping_postal_code: shipping.postal_code } : {}),
      metadata: {
        demo: !live,
        demo_seed: data.demo_seed ?? null,
        job_id: job.id,
        event: live ? "shopify.order.created" : "shopify.order.created.mock",
        mode: live ? "live" : "mock",
        ...(data.payment_kind ? { shopify_payment_kind: data.payment_kind } : {}),
      } as Json,
      tags: live ? ["jobs", "shopify", "live"] : ["jobs", "shopify", "mock"],
    })
    .select("id")
    .single();

  if (insert.error || !insert.data) {
    if (insert.error?.code === "23505") {
      const again = await admin
        .from("orders")
        .select("id")
        .eq("store_id", job.store_id)
        .eq("external_order_id", data.external_order_id)
        .maybeSingle();
      if (again.data) {
        return {
          ok: true,
          action: "skipped",
          entityType: "order",
          entityId: again.data.id,
          detail: "race_duplicate",
        };
      }
    }
    throw new PermanentJobError("DATABASE_ERROR", "No se pudo crear el pedido Shopify.");
  }

  if (data.line_items) {
    await syncShopifyOrderItems({
      admin,
      storeId: job.store_id,
      orderId: insert.data.id,
      lineItems: data.line_items,
    });
  }

  if (data.attribution) {
    await upsertShopifyOrderAttribution({
      admin,
      agencyId: job.agency_id,
      storeId: job.store_id,
      orderId: insert.data.id,
      customerId,
      attributedValue: total,
      attribution: data.attribution,
    });
  }

  return {
    ok: true,
    action: "created",
    entityType: "order",
    entityId: insert.data.id,
  };
};
