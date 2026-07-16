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
  createLiveCarrierProvider,
  type LiveEnviameCredentials,
} from "@/lib/integrations/enviame/live-carrier";
import { getEnviameEnv, resolveEnviameApiKey } from "@/lib/integrations/enviame/env";
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
    `Live ${kind} adapter is not configured. Shopify commerce and Enviame carrier are supported; set INTEGRATION_MODE=mock for other providers or implement the live adapter.`,
  );
}

/** Factory/registry: mock by default; Shopify commerce + Enviame carrier support live. */
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
  liveCreds?: LiveEnviameCredentials,
): CarrierProvider {
  const mode = resolveIntegrationMode();
  if (mode === "live") {
    if (providerId !== "enviame") {
      assertLiveProviderConfigured("carrier");
    }
    const env = getEnviameEnv();
    const apiKey = liveCreds?.apiKey || env.apiKey;
    if (!apiKey) {
      throw new Error(
        "Enviame live requiere ENVIAME_API_KEY (Vercel) o api_key en settings de la integración.",
      );
    }
    return createLiveCarrierProvider(providerId, {
      apiKey,
      apiBaseUrl: liveCreds?.apiBaseUrl ?? env.apiBaseUrl,
      companyId: liveCreds?.companyId ?? env.companyId,
    });
  }
  assertMockAllowed(mode);
  return createMockCarrierProvider(providerId);
}

/** Resolve live Enviame creds from integration JSON + env fallback. */
export function resolveLiveEnviameCredentials(
  settings: unknown,
  metadata: unknown,
): LiveEnviameCredentials | null {
  const apiKey = resolveEnviameApiKey(settings, metadata);
  if (!apiKey) return null;
  const env = getEnviameEnv();
  let companyId: string | null = env.companyId;
  for (const bag of [settings, metadata]) {
    if (bag && typeof bag === "object" && !Array.isArray(bag)) {
      const rec = bag as Record<string, unknown>;
      const c = rec.company_id ?? rec.companyId ?? rec.ENVIAME_COMPANY_ID;
      if (typeof c === "string" && c.trim()) companyId = c.trim();
      if (typeof c === "number" && Number.isFinite(c)) companyId = String(c);
    }
  }
  return { apiKey, apiBaseUrl: env.apiBaseUrl, companyId };
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
