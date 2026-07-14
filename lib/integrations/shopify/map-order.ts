import type { ProviderSyncEnqueueItem } from "@/lib/integrations/contracts/common";
import {
  mapGraphqlCustomerFields,
  mapRestCustomerFields,
  type ShopifyGraphqlCustomer,
  type ShopifyGraphqlMailingAddress,
  type ShopifyMappedCustomer,
  type ShopifyMappedShipping,
  type ShopifyRestCustomer,
  type ShopifyRestShippingAddress,
} from "@/lib/integrations/shopify/map-customer";
import {
  mapGraphqlLineItems,
  mapRestLineItems,
  type ShopifyGraphqlLineItemNode,
  type ShopifyMappedLineItem,
  type ShopifyRestLineItem,
} from "@/lib/integrations/shopify/map-line-items";
import {
  mapGraphqlOrderAttribution,
  mapRestOrderAttribution,
  type ShopifyGraphqlCustomerVisit,
  type ShopifyMappedAttribution,
} from "@/lib/integrations/shopify/map-attribution";
import {
  mapShopifyPayment,
  type ShopifyMappedPayment,
} from "@/lib/integrations/shopify/map-payment";

/** Extract numeric id from `gid://shopify/Order/123` or pass through digits. */
export function shopifyGidToExternalId(gidOrId: string): string {
  const trimmed = gidOrId.trim();
  const match = /\/(\d+)\s*$/.exec(trimmed);
  if (match?.[1]) return match[1];
  if (/^\d+$/.test(trimmed)) return trimmed;
  return trimmed;
}

export type ShopifyOrderJobPayload = {
  external_order_id: string;
  order_number?: string;
  currency_code: string;
  total_amount: number;
  subtotal_amount?: number;
  order_status?: string;
  mode: "live";
  customer?: ShopifyMappedCustomer;
  shipping?: ShopifyMappedShipping;
  line_items?: ShopifyMappedLineItem[];
  payment_kind?: ShopifyMappedPayment["payment_kind"];
  payment_status?: ShopifyMappedPayment["payment_status"];
  expected_cod_amount?: number | null;
  attribution?: ShopifyMappedAttribution;
};

/** REST webhook Order resource (orders/create | orders/updated). */
export type ShopifyRestOrder = {
  id?: number | string;
  admin_graphql_api_id?: string;
  name?: string | null;
  order_number?: number | string | null;
  currency?: string | null;
  total_price?: string | number | null;
  subtotal_price?: string | number | null;
  cancelled_at?: string | null;
  financial_status?: string | null;
  fulfillment_status?: string | null;
  updated_at?: string | null;
  created_at?: string | null;
  email?: string | null;
  phone?: string | null;
  tags?: string | string[] | null;
  gateway?: string | null;
  payment_gateway_names?: string[] | null;
  customer?: ShopifyRestCustomer | null;
  shipping_address?: ShopifyRestShippingAddress | null;
  line_items?: ShopifyRestLineItem[] | null;
  landing_site?: string | null;
  referring_site?: string | null;
  note?: string | null;
  note_attributes?: Array<{ name?: string | null; value?: string | null }> | null;
};

export type ShopifyGraphqlOrderNode = {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  cancelledAt?: string | null;
  displayFinancialStatus?: string | null;
  displayFulfillmentStatus?: string | null;
  email?: string | null;
  phone?: string | null;
  tags?: string[] | null;
  paymentGatewayNames?: string[] | null;
  totalPriceSet?: { shopMoney?: { amount?: string; currencyCode?: string } | null } | null;
  subtotalPriceSet?: { shopMoney?: { amount?: string; currencyCode?: string } | null } | null;
  customer?: ShopifyGraphqlCustomer | null;
  shippingAddress?: ShopifyGraphqlMailingAddress | null;
  lineItems?: { edges: Array<{ node: ShopifyGraphqlLineItemNode }> } | null;
  customerJourneySummary?: {
    lastVisit?: ShopifyGraphqlCustomerVisit | null;
    firstVisit?: ShopifyGraphqlCustomerVisit | null;
  } | null;
};

function parseMoney(value: string | number | null | undefined): number {
  if (typeof value === "number" && Number.isFinite(value)) return Math.max(0, value);
  if (typeof value === "string") {
    const n = Number.parseFloat(value);
    return Number.isFinite(n) ? Math.max(0, n) : 0;
  }
  return 0;
}

function mapFulfillmentToStatus(input: {
  cancelledAt?: string | null;
  financialStatus?: string | null;
  fulfillmentStatus?: string | null;
}): string | undefined {
  if (input.cancelledAt) return "cancelled";
  const fulfillment = (input.fulfillmentStatus ?? "").toUpperCase();
  if (fulfillment === "FULFILLED") return "shipped";
  if (fulfillment === "PARTIAL") return "ready_to_ship";
  const financial = (input.financialStatus ?? "").toUpperCase();
  if (financial === "REFUNDED" || financial === "VOIDED") return "cancelled";
  if (financial === "PAID" || financial === "PARTIALLY_PAID") return "confirmed";
  return undefined;
}

function attachMappedParts(
  payload: ShopifyOrderJobPayload,
  mapped: {
    customer?: ShopifyMappedCustomer;
    shipping?: ShopifyMappedShipping;
    line_items: ShopifyMappedLineItem[];
    payment: ShopifyMappedPayment;
    attribution?: ShopifyMappedAttribution;
  },
): ShopifyOrderJobPayload {
  return {
    ...payload,
    ...(mapped.customer ? { customer: mapped.customer } : {}),
    ...(mapped.shipping ? { shipping: mapped.shipping } : {}),
    line_items: mapped.line_items,
    payment_kind: mapped.payment.payment_kind,
    payment_status: mapped.payment.payment_status,
    expected_cod_amount: mapped.payment.expected_cod_amount,
    ...(mapped.attribution ? { attribution: mapped.attribution } : {}),
  };
}

export function mapRestOrderToCreatedPayload(order: ShopifyRestOrder): ShopifyOrderJobPayload {
  const externalId =
    order.id != null
      ? String(order.id)
      : order.admin_graphql_api_id
        ? shopifyGidToExternalId(order.admin_graphql_api_id)
        : "";
  const orderNumber =
    (typeof order.name === "string" && order.name.replace(/^#/, "").trim()) ||
    (order.order_number != null ? String(order.order_number) : undefined);
  const total_amount = parseMoney(order.total_price);
  const order_status = mapFulfillmentToStatus({
    cancelledAt: order.cancelled_at,
    financialStatus: order.financial_status,
    fulfillmentStatus: order.fulfillment_status,
  });
  const payment = mapShopifyPayment({
    financialStatus: order.financial_status,
    tags: order.tags,
    paymentGatewayNames: order.payment_gateway_names,
    gateway: order.gateway,
    totalAmount: total_amount,
  });
  const base: ShopifyOrderJobPayload = {
    external_order_id: externalId,
    order_number: orderNumber,
    currency_code: (order.currency || "PEN").slice(0, 3).toUpperCase(),
    total_amount,
    subtotal_amount: order.subtotal_price != null ? parseMoney(order.subtotal_price) : undefined,
    mode: "live",
    ...(order_status ? { order_status } : {}),
  };
  const customerShipping = mapRestCustomerFields({
    customer: order.customer,
    shipping_address: order.shipping_address,
    email: order.email,
    phone: order.phone,
  });
  return attachMappedParts(base, {
    ...customerShipping,
    line_items: mapRestLineItems(order.line_items),
    payment,
    attribution: mapRestOrderAttribution({
      landing_site: order.landing_site,
      referring_site: order.referring_site,
      note: order.note,
      note_attributes: order.note_attributes,
    }),
  });
}

export function mapRestOrderToUpdatedPayload(order: ShopifyRestOrder): ShopifyOrderJobPayload {
  return mapRestOrderToCreatedPayload(order);
}

export function mapGraphqlOrderToEnqueue(
  node: ShopifyGraphqlOrderNode,
  action: "created" | "updated",
): ProviderSyncEnqueueItem {
  const externalId = shopifyGidToExternalId(node.id);
  const money = node.totalPriceSet?.shopMoney;
  const sub = node.subtotalPriceSet?.shopMoney;
  const total_amount = parseMoney(money?.amount);
  const order_status = mapFulfillmentToStatus({
    cancelledAt: node.cancelledAt,
    financialStatus: node.displayFinancialStatus,
    fulfillmentStatus: node.displayFulfillmentStatus,
  });
  const payment = mapShopifyPayment({
    financialStatus: node.displayFinancialStatus,
    tags: node.tags,
    paymentGatewayNames: node.paymentGatewayNames,
    totalAmount: total_amount,
  });
  const base: ShopifyOrderJobPayload = {
    external_order_id: externalId,
    order_number: node.name.replace(/^#/, "").trim() || externalId,
    currency_code: (money?.currencyCode || "PEN").slice(0, 3).toUpperCase(),
    total_amount,
    subtotal_amount: sub?.amount != null ? parseMoney(sub.amount) : undefined,
    mode: "live",
    ...(order_status ? { order_status } : {}),
  };
  const customerShipping = mapGraphqlCustomerFields({
    customer: node.customer,
    shippingAddress: node.shippingAddress,
    email: node.email,
    phone: node.phone,
  });
  const journey = node.customerJourneySummary;
  const payload = attachMappedParts(base, {
    ...customerShipping,
    line_items: mapGraphqlLineItems(node.lineItems?.edges),
    payment,
    attribution: mapGraphqlOrderAttribution({
      lastVisit: journey?.lastVisit,
      firstVisit: journey?.firstVisit,
    }),
  });
  const jobType = action === "created" ? "shopify.order.created" : "shopify.order.updated";
  return {
    externalId,
    action,
    eventType: jobType,
    jobType,
    payload,
  };
}
