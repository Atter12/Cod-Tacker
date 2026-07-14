import { z } from "zod";

const ORDER_STATUSES = [
  "created",
  "pending_confirmation",
  "confirmed",
  "cancelled",
  "ready_to_ship",
  "shipped",
  "in_transit",
  "out_for_delivery",
  "delivered",
  "delivery_failed",
  "rejected",
  "return_in_transit",
  "returned",
  "lost",
  "closed",
] as const;

export const shopifyMappedCustomerSchema = z
  .object({
    external_customer_id: z.string().min(1).max(200).optional(),
    email: z.string().email().max(320).optional(),
    phone: z.string().min(6).max(40).optional(),
    first_name: z.string().min(1).max(200).optional(),
    last_name: z.string().min(1).max(200).optional(),
    country_code: z.string().length(2).optional(),
    city: z.string().min(1).max(200).optional(),
    region: z.string().min(1).max(200).optional(),
    postal_code: z.string().min(1).max(40).optional(),
  })
  .strict();

export const shopifyMappedShippingSchema = z
  .object({
    country_code: z.string().length(2).optional(),
    region: z.string().min(1).max(200).optional(),
    city: z.string().min(1).max(200).optional(),
    district: z.string().min(1).max(200).optional(),
    postal_code: z.string().min(1).max(40).optional(),
  })
  .strict();

/** Shared customer + shipping fields for create and update job payloads. */
export const shopifyOrderCustomerFieldsSchema = {
  customer: shopifyMappedCustomerSchema.optional(),
  shipping: shopifyMappedShippingSchema.optional(),
};

export const shopifyMappedLineItemSchema = z
  .object({
    external_line_item_id: z.string().min(1).max(200),
    external_product_id: z.string().min(1).max(200).optional(),
    external_variant_id: z.string().min(1).max(200).optional(),
    title: z.string().min(1).max(500),
    sku: z.string().min(1).max(120).optional(),
    quantity: z.number().int().positive(),
    unit_price: z.number().nonnegative(),
    total_discount: z.number().nonnegative().default(0),
    total_price: z.number().nonnegative(),
    product_title: z.string().min(1).max(500).optional(),
    variant_title: z.string().min(1).max(500).optional(),
    vendor: z.string().min(1).max(200).optional(),
    image_url: z.string().min(1).max(2000).optional(),
  })
  .strict();

export const shopifyOrderLineItemsFieldsSchema = {
  line_items: z.array(shopifyMappedLineItemSchema).max(200).optional(),
};

export const shopifyOrderPaymentFieldsSchema = {
  payment_kind: z.enum(["cod", "prepaid"]).optional(),
  payment_status: z.enum(["cash_expected", "unpaid", "refunded"]).optional(),
  expected_cod_amount: z.number().nonnegative().nullable().optional(),
};

export const shopifyOrderCreatedPayloadSchema = z.object({
  external_order_id: z.string().min(1).max(200),
  order_number: z.string().min(1).max(100).optional(),
  currency_code: z.string().length(3).default("PEN"),
  total_amount: z.number().nonnegative().default(0),
  subtotal_amount: z.number().nonnegative().optional(),
  order_status: z.enum(ORDER_STATUSES).optional(),
  demo_seed: z.string().min(1).max(200).optional(),
  mode: z.enum(["mock", "live"]).optional(),
  ...shopifyOrderCustomerFieldsSchema,
  ...shopifyOrderLineItemsFieldsSchema,
  ...shopifyOrderPaymentFieldsSchema,
});

export const shopifyOrderUpdatedPayloadSchema = z.object({
  external_order_id: z.string().min(1).max(200),
  order_status: z.enum(ORDER_STATUSES).optional(),
  total_amount: z.number().nonnegative().optional(),
  demo_seed: z.string().min(1).max(200).optional(),
  mode: z.enum(["mock", "live"]).optional(),
  ...shopifyOrderCustomerFieldsSchema,
  ...shopifyOrderLineItemsFieldsSchema,
  ...shopifyOrderPaymentFieldsSchema,
});

export { ORDER_STATUSES };
