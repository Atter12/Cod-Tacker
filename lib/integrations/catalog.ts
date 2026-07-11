import type { Enums } from "@/types/database.generated";

export type IntegrationProviderKind = "commerce" | "ads" | "carrier" | "messaging" | "settlement";

export type StoreIntegrationProvider = Extract<
  Enums<"integration_provider">,
  "shopify" | "meta" | "tiktok" | "whatsapp" | "enviame" | "custom_carrier" | "custom_payment"
>;

export type IntegrationCatalogEntry = {
  provider: StoreIntegrationProvider;
  name: string;
  description: string;
  kind: IntegrationProviderKind;
};

/** Providers offered in the store integrations center (mock catalog). */
export const INTEGRATION_CATALOG: readonly IntegrationCatalogEntry[] = [
  {
    provider: "shopify",
    name: "Shopify",
    description: "Pedidos, catálogo y clientes del comercio.",
    kind: "commerce",
  },
  {
    provider: "meta",
    name: "Meta Ads",
    description: "Campañas, conjuntos y gasto publicitario.",
    kind: "ads",
  },
  {
    provider: "tiktok",
    name: "TikTok Ads",
    description: "Campañas y métricas de publicidad.",
    kind: "ads",
  },
  {
    provider: "whatsapp",
    name: "WhatsApp Business",
    description: "Conversaciones y confirmaciones COD.",
    kind: "messaging",
  },
  {
    provider: "enviame",
    name: "Enviame",
    description: "Rastreo y estados de envío.",
    kind: "carrier",
  },
  {
    provider: "custom_carrier",
    name: "Carrier personalizado",
    description: "Conector genérico de logística.",
    kind: "carrier",
  },
  {
    provider: "custom_payment",
    name: "Pagos y conciliación",
    description: "Lotes de cobro y conciliación COD.",
    kind: "settlement",
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
