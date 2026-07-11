export type {
  IntegrationRuntimeMode,
  MockScenario,
  ProviderConnectionResult,
  ProviderError,
  ProviderHealthResult,
  ProviderHealthStatus,
  ProviderSyncInput,
  ProviderSyncKind,
  ProviderSyncResult,
} from "./common";
export { providerError } from "./common";

export type { CommerceOrderSnapshot, CommerceProvider, CommerceProviderId } from "./commerce";
export type { AdsProvider, AdsProviderId, AdsSpendSnapshot } from "./ads";
export type { CarrierProvider, CarrierProviderId, CarrierTrackingSnapshot } from "./carrier-provider";
export type { MessagingProvider, MessagingProviderId, MessagingSendResult } from "./messaging";
export type {
  SettlementBatchSnapshot,
  SettlementProvider,
  SettlementProviderId,
} from "./settlement-provider";

/** @deprecated Prefer CommerceProvider — kept for existing imports. */
export type { ShopifyAdapter, ShopifyConnection, ShopifyOrderWebhook, ShopifyProductWebhook } from "./shopify";
/** @deprecated Prefer AdsProvider — kept for existing imports. */
export type { AdAccount, AdCampaign, AdPlatformAdapter, AdSpend, ConversionPayload } from "./ad-platform";
/** @deprecated Prefer CarrierProvider — kept for existing imports. */
export type { CarrierAdapter, CarrierShipmentRequest, CarrierTrackingEvent, CarrierTrackingResult } from "./carrier";
/** @deprecated Prefer MessagingProvider — kept for existing imports. */
export type { WhatsAppAdapter, WhatsAppMessage, WhatsAppRecipient, WhatsAppTemplate } from "./whatsapp";
/** @deprecated Prefer SettlementProvider — kept for existing imports. */
export type { SettlementAdapter, SettlementBatch, SettlementItem } from "./settlement";
