import type { z } from "zod";
import { orderContactMetadataPatch } from "@/lib/conversions/resolve-order-contact";
import { shopifyOrderCreatedPayloadSchema } from "@/lib/jobs/handlers/shopify-order-payload";
import type { Json } from "@/types/database.generated";

type CreatedPayload = z.infer<typeof shopifyOrderCreatedPayloadSchema>;

/**
 * Row the create job writes so the order is visible in that store.
 * The store and agency come from the job, never from the Shopify payload.
 */
export function buildShopifyCreatedOrderInsert(input: {
  agencyId: string;
  storeId: string;
  jobId: string;
  customerId: string | null;
  now: string;
  live: boolean;
  data: CreatedPayload;
}) {
  const { data } = input;
  const total = data.total_amount;
  const shipping = data.shipping;
  const paymentStatus = data.payment_status ?? "cash_expected";
  const expectedCodAmount =
    data.expected_cod_amount !== undefined
      ? data.expected_cod_amount
      : paymentStatus === "cash_expected"
        ? total
        : null;

  return {
    agency_id: input.agencyId,
    store_id: input.storeId,
    customer_id: input.customerId,
    external_order_id: data.external_order_id,
    order_number: data.order_number ?? data.external_order_id,
    created_at_source: input.now,
    currency_code: data.currency_code,
    subtotal_amount: data.subtotal_amount ?? Math.max(0, total - (data.shipping_amount ?? 0)),
    total_amount: total,
    shipping_amount: data.shipping_amount ?? 0,
    tax_amount: 0,
    discount_amount: 0,
    order_status: data.order_status ?? "created",
    confirmation_status: "not_requested" as const,
    payment_status: paymentStatus,
    expected_cod_amount: expectedCodAmount,
    source_name: input.live ? "shopify" : "shopify.mock",
    ...(shipping?.country_code ? { shipping_country_code: shipping.country_code } : {}),
    ...(shipping?.region ? { shipping_region: shipping.region } : {}),
    ...(shipping?.city ? { shipping_city: shipping.city } : {}),
    ...(shipping?.district ? { shipping_district: shipping.district } : {}),
    ...(shipping?.postal_code ? { shipping_postal_code: shipping.postal_code } : {}),
    metadata: {
      demo: !input.live,
      demo_seed: data.demo_seed ?? null,
      job_id: input.jobId,
      event: input.live ? "shopify.order.created" : "shopify.order.created.mock",
      mode: input.live ? "live" : "mock",
      ...(data.payment_kind ? { shopify_payment_kind: data.payment_kind } : {}),
      ...(data.shipping_lines?.length ? { shopify_shipping_lines: data.shipping_lines } : {}),
      ...(data.note_attributes?.length ? { shopify_note_attributes: data.note_attributes } : {}),
      ...(shipping?.address1 ? { shopify_shipping_address1: shipping.address1 } : {}),
      ...orderContactMetadataPatch(data.customer),
    } as Json,
    tags: input.live ? ["jobs", "shopify", "live"] : ["jobs", "shopify", "mock"],
  };
}
