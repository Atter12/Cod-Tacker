import type { CommerceProvider } from "@/lib/integrations/contracts/commerce";
import {
  mockConnectResult,
  mockHealthResult,
  mockNowIso,
  mockSyncResult,
} from "@/lib/integrations/mock/scenario";

export function createMockCommerceProvider(
  providerId: CommerceProvider["providerId"] = "shopify",
): CommerceProvider {
  return {
    providerId,
    mode: "mock",
    async connect(input) {
      return mockConnectResult({
        externalAccountId: input.shopDomain || "demo-shop.myshopify.com",
        displayName: `Mock ${providerId} · ${input.shopDomain || "demo-shop"}`,
        credentialRef: input.credentialRef || "shopify-demo",
      });
    },
    async health() {
      return mockHealthResult("success");
    },
    async sync(input) {
      return mockSyncResult(input);
    },
    async listOrders(since) {
      const stamp = mockNowIso(`orders-${since ?? "all"}`);
      return [
        {
          externalId: "mock-order-1001",
          orderNumber: "COD-1001",
          currency: "PEN",
          total: 149.9,
          createdAt: stamp,
          updatedAt: stamp,
        },
      ];
    },
  };
}
