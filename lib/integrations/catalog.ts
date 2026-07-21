import type { Enums } from "@/types/database.generated";

/**
 * Role of a provider in the closed COD sales loop:
 * Ads → Commerce → Messaging → Carrier
 * (cash settlement lives in Conciliación, not as a catalog integration;
 * conversions / CAPI sit on top of terminal cash events).
 */
export type IntegrationProviderKind = "commerce" | "ads" | "carrier" | "messaging" | "settlement";

export type StoreIntegrationProvider = Extract<
  Enums<"integration_provider">,
  | "shopify"
  | "meta"
  | "tiktok"
  | "whatsapp"
  | "enviame"
  | "envia_com"
  | "custom_carrier"
>;

export type IntegrationCatalogEntry = {
  provider: StoreIntegrationProvider;
  name: string;
  description: string;
  kind: IntegrationProviderKind;
};

/** Order of kinds along the closed COD sales flow (for UI grouping / docs). */
export const INTEGRATION_KIND_FLOW_ORDER: readonly IntegrationProviderKind[] = [
  "ads",
  "commerce",
  "messaging",
  "carrier",
] as const;

export function labelProviderKind(kind: IntegrationProviderKind): string {
  switch (kind) {
    case "ads":
      return "Publicidad";
    case "commerce":
      return "E-commerce";
    case "messaging":
      return "Mensajería";
    case "carrier":
      return "Courier / logística";
    case "settlement":
      return "Cobro / conciliación";
    default: {
      const _exhaustive: never = kind;
      return _exhaustive;
    }
  }
}

/** Providers offered in the store integrations center. */
export const INTEGRATION_CATALOG: readonly IntegrationCatalogEntry[] = [
  {
    provider: "shopify",
    name: "Shopify",
    description: "Fuente de pedidos, clientes, ítems y señal COD vs prepaid.",
    kind: "commerce",
  },
  {
    provider: "meta",
    name: "Meta Ads",
    description: "Gasto, jerarquía de campañas y destino de conversiones CAPI.",
    kind: "ads",
  },
  {
    provider: "tiktok",
    name: "TikTok Ads",
    description: "Gasto y campañas; Events API Purchase terminal (CompletePayment).",
    kind: "ads",
  },
  {
    provider: "whatsapp",
    name: "WhatsApp Business",
    description: "Confirmación de pedidos COD y conversaciones operativas.",
    kind: "messaging",
  },
  {
    provider: "enviame",
    name: "Enviame",
    description: "Estados de envío normalizados: en tránsito, entregado, RTO.",
    kind: "carrier",
  },
  {
    provider: "envia_com",
    name: "Envia.com",
    description: "Multi-carrier: tracking y webhooks onShipmentStatusUpdate.",
    kind: "carrier",
  },
  {
    provider: "custom_carrier",
    name: "Carrier personalizado",
    description: "Conector genérico de logística cuando no hay Enviame/Envia.",
    kind: "carrier",
  },
] as const;

export function getCatalogEntry(provider: string): IntegrationCatalogEntry | undefined {
  return INTEGRATION_CATALOG.find((entry) => entry.provider === provider);
}

export function isStoreIntegrationProvider(value: string): value is StoreIntegrationProvider {
  return INTEGRATION_CATALOG.some((entry) => entry.provider === value);
}

export type SyncType = "incremental" | "backfill" | "manual_test";
export type SyncTriggerSource = "manual" | "scheduled" | "webhook" | "mock";
export type SyncRunStatus = "queued" | "running" | "completed" | "partial" | "failed" | "cancelled";
export type HealthCheckStatus = "healthy" | "degraded" | "down";

export function labelIntegrationStatus(status: string): string {
  switch (status) {
    case "connected":
      return "Conectado";
    case "pending":
      return "Pendiente";
    case "degraded":
      return "Degradado";
    case "error":
      return "Error";
    case "disconnected":
      return "Desconectado";
    case "revoked":
      return "Revocado";
    default:
      return status || "No conectado";
  }
}

export function labelSyncStatus(status: string): string {
  switch (status) {
    case "queued":
      return "En cola";
    case "running":
      return "En ejecución";
    case "completed":
      return "Completado";
    case "partial":
      return "Parcial";
    case "failed":
      return "Fallido";
    case "cancelled":
      return "Cancelado";
    default:
      return status;
  }
}

export function labelSyncType(syncType: string): string {
  switch (syncType) {
    case "incremental":
      return "Incremental";
    case "backfill":
      return "Backfill";
    case "manual_test":
      return "Prueba manual";
    default:
      return syncType;
  }
}

export function labelHealthStatus(status: string): string {
  switch (status) {
    case "healthy":
      return "Saludable";
    case "degraded":
      return "Degradado";
    case "down":
      return "Caído";
    default:
      return status;
  }
}
