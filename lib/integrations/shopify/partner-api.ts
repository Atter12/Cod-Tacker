import "server-only";

import {
  assertShopifyPartnerEnv,
  shopifyPartnerGraphqlUrl,
  type ShopifyPartnerEnv,
} from "@/lib/billing/shopify-partner-env";
import type { ShopifyActiveSubscriptionSnapshot } from "@/lib/billing/shopify-subscription-map";

const ACTIVE_SUBSCRIPTION_QUERY = `#graphql
  query ActiveSubscription($appId: ID!, $shopId: ID!) {
    activeSubscription(appId: $appId, shopId: $shopId) {
      billingPeriod
      cancelAtEndOfCycle
      trialEndsAt
      legacySubscriptionId
      currentBillingCycle {
        startTime
        endTime
      }
      items {
        handle
      }
      pendingUpdate {
        items {
          handle
        }
      }
    }
  }
`;

type PartnerGraphqlResponse = {
  data?: {
    activeSubscription?: {
      billingPeriod?: string | null;
      cancelAtEndOfCycle?: boolean | null;
      trialEndsAt?: string | null;
      legacySubscriptionId?: string | null;
      currentBillingCycle?: {
        startTime?: string | null;
        endTime?: string | null;
      } | null;
      items?: Array<{ handle?: string | null }> | null;
      pendingUpdate?: {
        items?: Array<{ handle?: string | null }> | null;
      } | null;
    } | null;
  };
  errors?: Array<{ message: string }>;
};

function toSnapshot(
  raw: NonNullable<NonNullable<PartnerGraphqlResponse["data"]>["activeSubscription"]>,
): ShopifyActiveSubscriptionSnapshot {
  return {
    billingPeriod: raw.billingPeriod ?? null,
    cancelAtEndOfCycle: Boolean(raw.cancelAtEndOfCycle),
    trialEndsAt: raw.trialEndsAt ?? null,
    legacySubscriptionId: raw.legacySubscriptionId ?? null,
    currentBillingCycle: raw.currentBillingCycle
      ? {
          startTime: raw.currentBillingCycle.startTime ?? null,
          endTime: raw.currentBillingCycle.endTime ?? null,
        }
      : null,
    items: (raw.items ?? []).map((item) => ({ handle: item.handle ?? null })),
    pendingUpdate: raw.pendingUpdate
      ? {
          items: (raw.pendingUpdate.items ?? []).map((item) => ({
            handle: item.handle ?? null,
          })),
        }
      : null,
  };
}

/**
 * Partner API: current Shopify App Pricing contract for app + shop.
 * Returns null when the shop has no active paid/trial contract.
 */
export async function fetchShopifyActiveSubscription(input: {
  appGid: string;
  shopGid: string;
  env?: ShopifyPartnerEnv;
}): Promise<ShopifyActiveSubscriptionSnapshot | null> {
  const env = input.env ?? assertShopifyPartnerEnv();
  const res = await fetch(shopifyPartnerGraphqlUrl(env), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Shopify-Access-Token": env.accessToken,
    },
    body: JSON.stringify({
      query: ACTIVE_SUBSCRIPTION_QUERY,
      variables: { appId: input.appGid, shopId: input.shopGid },
    }),
    cache: "no-store",
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Partner API failed (${res.status}): ${text.slice(0, 200)}`);
  }

  const json = (await res.json()) as PartnerGraphqlResponse;
  if (json.errors?.length) {
    throw new Error(json.errors.map((e) => e.message).join("; "));
  }

  const raw = json.data?.activeSubscription;
  if (!raw) return null;
  return toSnapshot(raw);
}
