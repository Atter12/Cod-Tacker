import "server-only";

import type { CommerceProvider } from "@/lib/integrations/contracts/commerce";
import { providerError } from "@/lib/integrations/contracts/common";
import { fetchShopifyShopInfo } from "@/lib/integrations/shopify/admin-api";
import { fetchShopifyOrdersForSync } from "@/lib/integrations/shopify/orders-sync";

export type LiveShopifyCredentials = {
  shopDomain: string;
  accessToken: string;
};

export function createLiveCommerceProvider(
  providerId: CommerceProvider["providerId"] = "shopify",
  creds: LiveShopifyCredentials,
): CommerceProvider {
  return {
    providerId,
    mode: "live",
    async connect() {
      return {
        ok: true,
        mode: "live",
        externalAccountId: creds.shopDomain,
        displayName: creds.shopDomain,
        credentialRef: `live:shopify:${creds.shopDomain}`,
      };
    },
    async health() {
      const started = Date.now();
      try {
        const info = await fetchShopifyShopInfo(creds.shopDomain, creds.accessToken);
        return {
          status: "healthy",
          mode: "live",
          checkedAt: new Date().toISOString(),
          latencyMs: Date.now() - started,
          message: `Conectado a ${info.name}`,
          demo: false,
        };
      } catch (err) {
        return {
          status: "unhealthy",
          mode: "live",
          checkedAt: new Date().toISOString(),
          latencyMs: Date.now() - started,
          message: err instanceof Error ? err.message.slice(0, 200) : "Shopify health failed",
          demo: false,
        };
      }
    },
    async sync(input) {
      const started = Date.now();
      try {
        const result = await fetchShopifyOrdersForSync({
          shop: creds.shopDomain,
          accessToken: creds.accessToken,
          kind: input.kind,
          cursor: input.cursor,
        });
        const created = result.enqueues.filter((e) => e.action === "created").length;
        return {
          ok: true,
          mode: "live",
          processed: result.processed,
          inserted: created,
          updated: result.enqueues.filter((e) => e.action === "updated").length,
          duplicates: 0,
          nextCursor: result.nextCursor,
          durationMs: Date.now() - started,
          demo: false,
          enqueues: result.enqueues,
        };
      } catch (err) {
        return {
          ok: false,
          mode: "live",
          demo: false,
          error: providerError(
            "SHOPIFY_SYNC_FAILED",
            err instanceof Error ? err.message.slice(0, 200) : "Falló la sincronización Shopify.",
            { retryable: true },
          ),
        };
      }
    },
    async listOrders(since) {
      const result = await fetchShopifyOrdersForSync({
        shop: creds.shopDomain,
        accessToken: creds.accessToken,
        kind: since ? "incremental" : "historical",
      });
      return result.enqueues
        .filter((e) => e.action === "created")
        .map((e) => ({
          externalId: e.externalId,
          orderNumber: String(e.payload.order_number ?? e.externalId),
          currency: String(e.payload.currency_code ?? "PEN"),
          total: Number(e.payload.total_amount ?? 0),
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }));
    },
  };
}
