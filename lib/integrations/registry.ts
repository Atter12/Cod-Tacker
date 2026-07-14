import "server-only";

import {
  areMockIntegrationsEnabled,
  resolveIntegrationMode,
  type IntegrationMode,
} from "@/config/env";
import type { AdsProvider } from "@/lib/integrations/contracts/ads";
import type { CarrierProvider } from "@/lib/integrations/contracts/carrier-provider";
import type { CommerceProvider } from "@/lib/integrations/contracts/commerce";
import type { MessagingProvider } from "@/lib/integrations/contracts/messaging";
import type { SettlementProvider } from "@/lib/integrations/contracts/settlement-provider";
import {
  createMockAdsProvider,
  createMockCarrierProvider,
  createMockCommerceProvider,
  createMockMessagingProvider,
  createMockSettlementProvider,
} from "@/lib/integrations/mock";
import {
  createLiveCommerceProvider,
  type LiveShopifyCredentials,
} from "@/lib/integrations/shopify/live-commerce";

export type ProviderKind = "commerce" | "ads" | "carrier" | "messaging" | "settlement";

function assertMockAllowed(mode: IntegrationMode): void {
  if (mode === "mock" && !areMockIntegrationsEnabled()) {
    throw new Error("Mock integrations are disabled (MOCK_INTEGRATIONS_ENABLED=false).");
  }
}

function assertLiveProviderConfigured(kind: ProviderKind): never {
  throw new Error(
    `Live ${kind} adapter is not configured. Shopify live is supported; set INTEGRATION_MODE=mock for other providers or implement the live adapter.`,
  );
}

/** Factory/registry: mock by default; Shopify commerce supports live credentials. */
export function getIntegrationRuntimeMode(): IntegrationMode {
  return resolveIntegrationMode();
}

export function isDemoIntegrationMode(): boolean {
  return getIntegrationRuntimeMode() === "mock";
}

export function getCommerceProvider(
  providerId: CommerceProvider["providerId"] = "shopify",
  liveCreds?: LiveShopifyCredentials,
): CommerceProvider {
  const mode = resolveIntegrationMode();
  if (mode === "live") {
    if (providerId !== "shopify") {
      assertLiveProviderConfigured("commerce");
    }
    if (!liveCreds?.shopDomain || !liveCreds?.accessToken) {
      throw new Error(
        "Shopify live requiere dominio y access token cifrado. Reconecta la tienda vía OAuth.",
      );
    }
    return createLiveCommerceProvider(providerId, liveCreds);
  }
  assertMockAllowed(mode);
  return createMockCommerceProvider(providerId);
}

export function getAdsProvider(providerId: AdsProvider["providerId"] = "meta"): AdsProvider {
  const mode = resolveIntegrationMode();
  if (mode === "live") assertLiveProviderConfigured("ads");
  assertMockAllowed(mode);
  return createMockAdsProvider(providerId);
}

export function getCarrierProvider(
  providerId: CarrierProvider["providerId"] = "enviame",
): CarrierProvider {
  const mode = resolveIntegrationMode();
  if (mode === "live") assertLiveProviderConfigured("carrier");
  assertMockAllowed(mode);
  return createMockCarrierProvider(providerId);
}

export function getMessagingProvider(
  providerId: MessagingProvider["providerId"] = "whatsapp",
): MessagingProvider {
  const mode = resolveIntegrationMode();
  if (mode === "live") assertLiveProviderConfigured("messaging");
  assertMockAllowed(mode);
  return createMockMessagingProvider(providerId);
}

export function getSettlementProvider(
  providerId: SettlementProvider["providerId"] = "custom_payment",
): SettlementProvider {
  const mode = resolveIntegrationMode();
  if (mode === "live") assertLiveProviderConfigured("settlement");
  assertMockAllowed(mode);
  return createMockSettlementProvider(providerId);
}
