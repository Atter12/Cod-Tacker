import "server-only";

import { getShopifyEnv } from "@/lib/integrations/shopify/env";
import { shopifyAdminGraphql } from "@/lib/integrations/shopify/graphql";

export const SHOPIFY_ORDER_WEBHOOK_TOPICS = ["ORDERS_CREATE", "ORDERS_UPDATED"] as const;
export type ShopifyOrderWebhookTopic = (typeof SHOPIFY_ORDER_WEBHOOK_TOPICS)[number];

export type ShopifyWebhookRegistrationResult = {
  topic: ShopifyOrderWebhookTopic;
  ok: boolean;
  id?: string;
  error?: string;
};

function webhookCallbackUri(appUrl: string): string {
  return `${appUrl.replace(/\/$/, "")}/api/integrations/shopify/webhooks`;
}

type CreateResult = {
  webhookSubscriptionCreate?: {
    webhookSubscription?: { id: string; topic: string; uri?: string | null } | null;
    userErrors?: Array<{ field?: string[] | null; message: string }>;
  };
};

type ListResult = {
  webhookSubscriptions?: {
    edges: Array<{ node: { id: string; topic: string; endpoint?: { __typename?: string; callbackUrl?: string } | null } }>;
  };
};

/**
 * Ensure ORDERS_CREATE / ORDERS_UPDATED HTTPS subscriptions point at CODTracked.
 * Soft-idempotent: skips create when an equivalent callback already exists.
 */
export async function registerShopifyOrderWebhooks(
  shop: string,
  accessToken: string,
): Promise<{ callbackUri: string; results: ShopifyWebhookRegistrationResult[] }> {
  const { appUrl } = getShopifyEnv();
  const callbackUri = webhookCallbackUri(appUrl);
  const existing = await shopifyAdminGraphql<ListResult>(
    shop,
    accessToken,
    `#graphql
      query ListWebhookSubscriptions($first: Int!) {
        webhookSubscriptions(first: $first) {
          edges {
            node {
              id
              topic
              endpoint {
                __typename
                ... on WebhookHttpEndpoint {
                  callbackUrl
                }
              }
            }
          }
        }
      }
    `,
    { first: 50 },
  );

  const edges = existing.webhookSubscriptions?.edges ?? [];
  const results: ShopifyWebhookRegistrationResult[] = [];

  for (const topic of SHOPIFY_ORDER_WEBHOOK_TOPICS) {
    const already = edges.find((e) => {
      const node = e.node;
      if (node.topic !== topic) return false;
      const url = node.endpoint?.callbackUrl?.replace(/\/$/, "");
      return url === callbackUri.replace(/\/$/, "");
    });
    if (already) {
      results.push({ topic, ok: true, id: already.node.id });
      continue;
    }

    try {
      const created = await shopifyAdminGraphql<CreateResult>(
        shop,
        accessToken,
        `#graphql
          mutation WebhookSubscriptionCreate(
            $topic: WebhookSubscriptionTopic!
            $webhookSubscription: WebhookSubscriptionInput!
          ) {
            webhookSubscriptionCreate(topic: $topic, webhookSubscription: $webhookSubscription) {
              webhookSubscription {
                id
                topic
                uri
              }
              userErrors {
                field
                message
              }
            }
          }
        `,
        {
          topic,
          webhookSubscription: { uri: callbackUri, format: "JSON" },
        },
      );
      const payload = created.webhookSubscriptionCreate;
      const errors = payload?.userErrors?.filter((e) => e.message) ?? [];
      if (errors.length || !payload?.webhookSubscription?.id) {
        results.push({
          topic,
          ok: false,
          error: errors.map((e) => e.message).join("; ") || "No se creó la suscripción.",
        });
        continue;
      }
      results.push({ topic, ok: true, id: payload.webhookSubscription.id });
    } catch (err) {
      results.push({
        topic,
        ok: false,
        error: err instanceof Error ? err.message : "Error al registrar webhook",
      });
    }
  }

  return { callbackUri, results };
}
