import "server-only";

import {
  mapRestOrderAttribution,
  type ShopifyMappedAttribution,
} from "@/lib/integrations/shopify/map-attribution";
import { shopifyAdminGraphql } from "@/lib/integrations/shopify/graphql";

type JourneyVisit = {
  landingPage?: string | null;
  referrerUrl?: string | null;
  utmParameters?: {
    source?: string | null;
    medium?: string | null;
    campaign?: string | null;
    content?: string | null;
    term?: string | null;
  } | null;
};

type OrderAttributionQuery = {
  order?: {
    note?: string | null;
    customAttributes?: Array<{ key?: string | null; value?: string | null }> | null;
    customerJourneySummary?: {
      ready?: boolean | null;
      firstVisit?: JourneyVisit | null;
      lastVisit?: JourneyVisit | null;
    } | null;
  } | null;
};

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function mapOrderNodeToAttribution(
  node: NonNullable<OrderAttributionQuery["order"]>,
  current?: ShopifyMappedAttribution | null,
): ShopifyMappedAttribution {
  const journey = node.customerJourneySummary;
  const visit = journey?.lastVisit ?? journey?.firstVisit ?? null;
  const utm = visit?.utmParameters;
  return mapRestOrderAttribution({
    landing_site: visit?.landingPage ?? current?.landing_site ?? null,
    referring_site: visit?.referrerUrl ?? current?.referring_site ?? null,
    note: node.note,
    note_attributes: [
      ...(node.customAttributes ?? []).map((row) => ({
        name: row.key,
        value: row.value,
      })),
      { name: "utm_source", value: utm?.source ?? current?.utm_source },
      { name: "utm_medium", value: utm?.medium ?? current?.utm_medium },
      { name: "utm_campaign", value: utm?.campaign ?? current?.utm_campaign },
      { name: "utm_content", value: utm?.content ?? current?.utm_content },
      { name: "utm_term", value: utm?.term ?? current?.utm_term },
      { name: "fbclid", value: current?.fbclid },
      { name: "ttclid", value: current?.ttclid },
      { name: "gclid", value: current?.gclid },
    ],
  });
}

async function queryOrderAttribution(
  shop: string,
  accessToken: string,
  externalOrderId: string,
  current?: ShopifyMappedAttribution | null,
): Promise<{ attribution: ShopifyMappedAttribution; ready: boolean } | null> {
  const gid = externalOrderId.startsWith("gid://")
    ? externalOrderId
    : `gid://shopify/Order/${externalOrderId}`;

  const data = await shopifyAdminGraphql<OrderAttributionQuery>(
    shop,
    accessToken,
    `#graphql
      query OrderAttributionEnrich($id: ID!) {
        order(id: $id) {
          note
          customAttributes {
            key
            value
          }
          customerJourneySummary {
            ready
            firstVisit {
              landingPage
              referrerUrl
              utmParameters {
                source
                medium
                campaign
                content
                term
              }
            }
            lastVisit {
              landingPage
              referrerUrl
              utmParameters {
                source
                medium
                campaign
                content
                term
              }
            }
          }
        }
      }
    `,
    { id: gid },
  );

  if (!data.order) return null;
  return {
    ready: data.order.customerJourneySummary?.ready !== false,
    attribution: mapOrderNodeToAttribution(data.order, current),
  };
}

/**
 * When REST webhook payload lacks UTM/click IDs, pull GraphQL journey + customAttributes
 * so attribution lands on create instead of waiting for a later orders/updated.
 *
 * Retries once briefly when customerJourneySummary.ready is false (Shopify lag).
 */
export async function enrichShopifyOrderAttribution(input: {
  shop: string;
  accessToken: string;
  externalOrderId: string;
  current?: ShopifyMappedAttribution | null;
  retryDelayMs?: number;
}): Promise<{
  attribution: ShopifyMappedAttribution;
  enriched: boolean;
  journeyReady: boolean | null;
}> {
  const current =
    input.current ??
    mapRestOrderAttribution({
      landing_site: null,
      referring_site: null,
    });

  if (current.has_attribution) {
    return { attribution: current, enriched: false, journeyReady: null };
  }

  const retryDelayMs = input.retryDelayMs ?? 1500;
  let result = await queryOrderAttribution(
    input.shop,
    input.accessToken,
    input.externalOrderId,
    current,
  );
  if (!result) {
    return { attribution: current, enriched: false, journeyReady: null };
  }

  if (!result.attribution.has_attribution && !result.ready && retryDelayMs > 0) {
    await sleep(retryDelayMs);
    const second = await queryOrderAttribution(
      input.shop,
      input.accessToken,
      input.externalOrderId,
      current,
    );
    if (second) result = second;
  }

  return {
    attribution: result.attribution.has_attribution ? result.attribution : current,
    enriched: result.attribution.has_attribution,
    journeyReady: result.ready,
  };
}
