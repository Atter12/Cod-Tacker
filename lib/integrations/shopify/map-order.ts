import type { ProviderSyncEnqueueItem } from "@/lib/integrations/contracts/common";

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
};

export type ShopifyGraphqlOrderNode = {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  cancelledAt?: string | null;
  displayFinancialStatus?: string | null;
  displayFulfillmentStatus?: string | null;
  totalPriceSet?: { shopMoney?: { amount?: string; currencyCode?: string } | null } | null;
  subtotalPriceSet?: { shopMoney?: { amount?: string; currencyCode?: string } | null } | null;
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
  return {
    external_order_id: externalId,
    order_number: orderNumber,
    currency_code: (order.currency || "PEN").slice(0, 3).toUpperCase(),
    total_amount: parseMoney(order.total_price),
    subtotal_amount: order.subtotal_price != null ? parseMoney(order.subtotal_price) : undefined,
    mode: "live",
  };
}

export function mapRestOrderToUpdatedPayload(order: ShopifyRestOrder): ShopifyOrderJobPayload {
  const base = mapRestOrderToCreatedPayload(order);
  const order_status = mapFulfillmentToStatus({
    cancelledAt: order.cancelled_at,
    financialStatus: order.financial_status,
    fulfillmentStatus: order.fulfillment_status,
  });
  return { ...base, order_status };
}

export function mapGraphqlOrderToEnqueue(
  node: ShopifyGraphqlOrderNode,
  action: "created" | "updated",
): ProviderSyncEnqueueItem {
  const externalId = shopifyGidToExternalId(node.id);
  const money = node.totalPriceSet?.shopMoney;
  const sub = node.subtotalPriceSet?.shopMoney;
  const payload: ShopifyOrderJobPayload = {
    external_order_id: externalId,
    order_number: node.name.replace(/^#/, "").trim() || externalId,
    currency_code: (money?.currencyCode || "PEN").slice(0, 3).toUpperCase(),
    total_amount: parseMoney(money?.amount),
    subtotal_amount: sub?.amount != null ? parseMoney(sub.amount) : undefined,
    mode: "live",
  };
  if (action === "updated") {
    payload.order_status = mapFulfillmentToStatus({
      cancelledAt: node.cancelledAt,
      financialStatus: node.displayFinancialStatus,
      fulfillmentStatus: node.displayFulfillmentStatus,
    });
  }
  const jobType = action === "created" ? "shopify.order.created" : "shopify.order.updated";
  return {
    externalId,
    action,
    eventType: jobType,
    jobType,
    payload,
  };
}
