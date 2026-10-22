import "server-only";

import type { ShopifyAppSubscriptionSnapshot } from "@/lib/billing/shopify-subscription-map";
import { shopifyAdminGraphql } from "@/lib/integrations/shopify/graphql";

const CURRENT_APP_SUBSCRIPTIONS_QUERY = `#graphql
  query CurrentAppSubscriptions {
    currentAppInstallation {
      activeSubscriptions {
        id
        name
        status
        createdAt
        currentPeriodEnd
        trialDays
        lineItems {
          plan {
            pricingDetails {
              __typename
              ... on AppRecurringPricing {
                interval
              }
            }
          }
        }
      }
    }
  }
`;

type CurrentAppSubscriptionsResponse = {
  currentAppInstallation?: {
    activeSubscriptions?: Array<{
      id: string;
      name?: string | null;
      status?: string | null;
      createdAt?: string | null;
      currentPeriodEnd?: string | null;
      trialDays?: number | null;
      lineItems?: Array<{
        plan?: { pricingDetails?: { __typename?: string; interval?: string | null } | null } | null;
      }> | null;
    }> | null;
  } | null;
};

/**
 * App Pricing subscriptions of this app on one shop, read with the shop's offline
 * token (Admin API). No Partner API token or org permissions needed.
 */
export async function fetchShopifyAppSubscriptions(
  shop: string,
  accessToken: string,
): Promise<ShopifyAppSubscriptionSnapshot[]> {
  const data = await shopifyAdminGraphql<CurrentAppSubscriptionsResponse>(
    shop,
    accessToken,
    CURRENT_APP_SUBSCRIPTIONS_QUERY,
  );
  return (data.currentAppInstallation?.activeSubscriptions ?? []).map((sub) => ({
    id: sub.id,
    name: sub.name ?? "",
    status: sub.status ?? "",
    createdAt: sub.createdAt ?? null,
    currentPeriodEnd: sub.currentPeriodEnd ?? null,
    trialDays: sub.trialDays ?? null,
    interval:
      sub.lineItems?.find((item) => item.plan?.pricingDetails?.__typename === "AppRecurringPricing")
        ?.plan?.pricingDetails?.interval ?? null,
  }));
}
