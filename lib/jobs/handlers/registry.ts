import { handleAdsHierarchySeeded } from "@/lib/jobs/handlers/ads-hierarchy-seeded";
import { handleAdsSpendSynced } from "@/lib/jobs/handlers/ads-spend-synced";
import { handleCarrierShipmentUpdated } from "@/lib/jobs/handlers/carrier-shipment-updated";
import { handleSettlementBatchReceived } from "@/lib/jobs/handlers/settlement-batch-received";
import { handleSettlementCsvImported } from "@/lib/jobs/handlers/settlement-csv-imported";
import { handleShopifyOrderCreated } from "@/lib/jobs/handlers/shopify-order-created";
import { handleShopifyOrderUpdated } from "@/lib/jobs/handlers/shopify-order-updated";
import { handleWhatsappMessageReceived } from "@/lib/jobs/handlers/whatsapp-message-received";
import { handleWhatsappStatusUpdated } from "@/lib/jobs/handlers/whatsapp-status-updated";
import { handlePrivacyDataExport } from "@/lib/jobs/handlers/privacy-data-export";
import type { JobHandler } from "@/lib/jobs/types";

export const JOB_TYPES = [
  "shopify.order.created.mock",
  "shopify.order.updated.mock",
  "ads.spend.synced.mock",
  "ads.hierarchy.seeded.mock",
  "carrier.shipment.updated.mock",
  "whatsapp.message.received.mock",
  "whatsapp.status.updated.mock",
  "settlement.batch.received.mock",
  "settlement.csv.imported.mock",
  "privacy.data_export.mock",
] as const;

export type KnownJobType = (typeof JOB_TYPES)[number];

const registry: Record<KnownJobType, JobHandler> = {
  "shopify.order.created.mock": handleShopifyOrderCreated,
  "shopify.order.updated.mock": handleShopifyOrderUpdated,
  "ads.spend.synced.mock": handleAdsSpendSynced,
  "ads.hierarchy.seeded.mock": handleAdsHierarchySeeded,
  "carrier.shipment.updated.mock": handleCarrierShipmentUpdated,
  "whatsapp.message.received.mock": handleWhatsappMessageReceived,
  "whatsapp.status.updated.mock": handleWhatsappStatusUpdated,
  "settlement.batch.received.mock": handleSettlementBatchReceived,
  "settlement.csv.imported.mock": handleSettlementCsvImported,
  "privacy.data_export.mock": handlePrivacyDataExport,
};

export function getJobHandler(jobType: string): JobHandler | null {
  if (jobType in registry) return registry[jobType as KnownJobType];
  return null;
}

export function listRegisteredJobTypes(): readonly KnownJobType[] {
  return JOB_TYPES;
}
