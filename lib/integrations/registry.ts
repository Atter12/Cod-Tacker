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

export type ProviderKind = "commerce" | "ads" | "carrier" | "messaging" | "settlement";

function assertMockAllowed(mode: IntegrationMode): void {
  if (mode === "mock" && !areMockIntegrationsEnabled()) {
    throw new Error("Mock integrations are disabled (MOCK_INTEGRATIONS_ENABLED=false).");
  }
  if (mode === "live") {
    throw new Error(
      "Live provider adapters are not configured in this environment. Set INTEGRATION_MODE=mock for demonstration.",
    );
  }
}

/** Factory/registry: selects mock adapters via server-only configuration. No fake live adapters. */
export function getIntegrationRuntimeMode(): IntegrationMode {
  return resolveIntegrationMode();
}

export function isDemoIntegrationMode(): boolean {
  return getIntegrationRuntimeMode() === "mock";
}

export function getCommerceProvider(
  providerId: CommerceProvider["providerId"] = "shopify",
): CommerceProvider {
  const mode = resolveIntegrationMode();
  assertMockAllowed(mode);
  return createMockCommerceProvider(providerId);
}

export function getAdsProvider(providerId: AdsProvider["providerId"] = "meta"): AdsProvider {
  const mode = resolveIntegrationMode();
  assertMockAllowed(mode);
  return createMockAdsProvider(providerId);
}

export function getCarrierProvider(
  providerId: CarrierProvider["providerId"] = "enviame",
): CarrierProvider {
  const mode = resolveIntegrationMode();
  assertMockAllowed(mode);
  return createMockCarrierProvider(providerId);
}

export function getMessagingProvider(
  providerId: MessagingProvider["providerId"] = "whatsapp",
): MessagingProvider {
  const mode = resolveIntegrationMode();
  assertMockAllowed(mode);
  return createMockMessagingProvider(providerId);
}

export function getSettlementProvider(
  providerId: SettlementProvider["providerId"] = "custom_payment",
): SettlementProvider {
  const mode = resolveIntegrationMode();
  assertMockAllowed(mode);
  return createMockSettlementProvider(providerId);
}
