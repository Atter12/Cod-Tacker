import "server-only";

import type { ProviderSyncEnqueueItem, ProviderSyncKind } from "@/lib/integrations/contracts/common";
import { shopifyAdminGraphql } from "@/lib/integrations/shopify/graphql";
import {
  mapGraphqlOrderToEnqueue,
  type ShopifyGraphqlOrderNode,
} from "@/lib/integrations/shopify/map-order";

type OrdersQueryData = {
  orders: {
    edges: Array<{ cursor: string; node: ShopifyGraphqlOrderNode }>;
    pageInfo: { hasNextPage: boolean; endCursor: string | null };
  };
};

const PAGE_SIZE = 50;
const MAX_PAGES_HISTORICAL = 5;
const MAX_PAGES_INCREMENTAL = 2;

/**
 * Pull recent/historical orders and build live enqueue specs.
 * Incremental: last 7 days. Historical: last 90 days (capped pages).
 */
export async function fetchShopifyOrdersForSync(input: {
  shop: string;
  accessToken: string;
  kind: ProviderSyncKind;
  cursor?: string | null;
}): Promise<{
  enqueues: ProviderSyncEnqueueItem[];
  nextCursor: string | null;
  processed: number;
}> {
  const days = input.kind === "historical" ? 90 : 7;
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const queryFilter = `updated_at:>=${since}`;
  const maxPages = input.kind === "historical" ? MAX_PAGES_HISTORICAL : MAX_PAGES_INCREMENTAL;

  const enqueues: ProviderSyncEnqueueItem[] = [];
  let after: string | null | undefined = input.cursor || null;
  let nextCursor: string | null = null;
  let pages = 0;

  while (pages < maxPages) {
    pages += 1;
    const data: OrdersQueryData = await shopifyAdminGraphql<OrdersQueryData>(
      input.shop,
      input.accessToken,
      `#graphql
        query OrdersSync($first: Int!, $after: String, $query: String) {
          orders(first: $first, after: $after, query: $query, sortKey: UPDATED_AT, reverse: true) {
            edges {
              cursor
              node {
                id
                name
                createdAt
                updatedAt
                cancelledAt
                displayFinancialStatus
                displayFulfillmentStatus
                email
                phone
                tags
                paymentGatewayNames
                totalPriceSet {
                  shopMoney {
                    amount
                    currencyCode
                  }
                }
                subtotalPriceSet {
                  shopMoney {
                    amount
                    currencyCode
                  }
                }
                customer {
                  id
                  email
                  phone
                  firstName
                  lastName
                }
                shippingAddress {
                  firstName
                  lastName
                  phone
                  city
                  province
                  zip
                  countryCodeV2
                }
                lineItems(first: 50) {
                  edges {
                    node {
                      id
                      title
                      quantity
                      sku
                      variantTitle
                      originalUnitPriceSet {
                        shopMoney {
                          amount
                        }
                      }
                      discountedTotalSet {
                        shopMoney {
                          amount
                        }
                      }
                      totalDiscountSet {
                        shopMoney {
                          amount
                        }
                      }
                      variant {
                        id
                        title
                        sku
                        price
                        product {
                          id
                          title
                          vendor
                          featuredImage {
                            url
                          }
                        }
                      }
                    }
                  }
                }
              }
            }
            pageInfo {
              hasNextPage
              endCursor
            }
          }
        }
      `,
      { first: PAGE_SIZE, after, query: queryFilter },
    );

    for (const edge of data.orders.edges) {
      // Sync treats fetched orders as upserts: created handler is idempotent on external id;
      // updated covers status changes when the order already exists.
      enqueues.push(mapGraphqlOrderToEnqueue(edge.node, "created"));
      enqueues.push(mapGraphqlOrderToEnqueue(edge.node, "updated"));
    }

    if (!data.orders.pageInfo.hasNextPage) {
      nextCursor = null;
      break;
    }
    nextCursor = data.orders.pageInfo.endCursor;
    after = nextCursor;
  }

  return {
    enqueues,
    nextCursor,
    processed: enqueues.filter((e) => e.action === "created").length,
  };
}
