import { handleAdsHierarchySeeded } from "@/lib/jobs/handlers/ads-hierarchy-seeded";
import { handleAdsSpendSynced } from "@/lib/jobs/handlers/ads-spend-synced";
import { handleCarrierShipmentUpdated } from "@/lib/jobs/handlers/carrier-shipment-updated";
import { handleSettlementBatchReceived } from "@/lib/jobs/handlers/settlement-batch-received";
import { handleSettlementCsvImported } from "@/lib/jobs/handlers/settlement-csv-imported";
import { handleShopifyOrderCreated } from "@/lib/jobs/handlers/shopify-order-created";
import { handleShopifyOrderUpdated } from "@/lib/jobs/handlers/shopify-order-updated";
import { handleWhatsappMessageReceived } from "@/lib/jobs/handlers/whatsapp-message-received";
import { handleWhatsappStatusUpdated } from "@/lib/jobs/handlers/whatsapp-status-updated";
import { handleWhatsappConfirmationRequest } from "@/lib/jobs/handlers/whatsapp-confirmation-request";
import { handlePrivacyDataExport } from "@/lib/jobs/handlers/privacy-data-export";
import type { JobHandler } from "@/lib/jobs/types";

export const JOB_TYPES = [
  "shopify.order.created",
  "shopify.order.updated",
  "shopify.order.created.mock",
  "shopify.order.updated.mock",
  "ads.spend.synced",
  "ads.spend.synced.mock",
  "ads.hierarchy.seeded.mock",
  "carrier.shipment.updated",
  "carrier.shipment.updated.mock",
  "whatsapp.message.received",
  "whatsapp.message.received.mock",
  "whatsapp.status.updated",
  "whatsapp.status.updated.mock",
  "whatsapp.confirmation.request",
  "settlement.batch.received.mock",
  "settlement.csv.imported",
  "settlement.csv.imported.mock",
  "settlement.ecart.synced",
  "privacy.data_export.mock",
] as const;

export type KnownJobType = (typeof JOB_TYPES)[number];

const registry: Record<KnownJobType, JobHandler> = {
  "shopify.order.created": handleShopifyOrderCreated,
  "shopify.order.updated": handleShopifyOrderUpdated,
  "shopify.order.created.mock": handleShopifyOrderCreated,
  "shopify.order.updated.mock": handleShopifyOrderUpdated,
  "ads.spend.synced": handleAdsSpendSynced,
  "ads.spend.synced.mock": handleAdsSpendSynced,
  "ads.hierarchy.seeded.mock": handleAdsHierarchySeeded,
  "carrier.shipment.updated": handleCarrierShipmentUpdated,
  "carrier.shipment.updated.mock": handleCarrierShipmentUpdated,
  "whatsapp.message.received": handleWhatsappMessageReceived,
  "whatsapp.message.received.mock": handleWhatsappMessageReceived,
  "whatsapp.status.updated": handleWhatsappStatusUpdated,
  "whatsapp.status.updated.mock": handleWhatsappStatusUpdated,
  "whatsapp.confirmation.request": handleWhatsappConfirmationRequest,
  "settlement.batch.received.mock": handleSettlementBatchReceived,
  "settlement.csv.imported": handleSettlementCsvImported,
  "settlement.csv.imported.mock": handleSettlementCsvImported,
  "settlement.ecart.synced": handleSettlementCsvImported,
  "privacy.data_export.mock": handlePrivacyDataExport,
};

export function getJobHandler(jobType: string): JobHandler | null {
  if (jobType in registry) return registry[jobType as KnownJobType];
  return null;
}

export function listRegisteredJobTypes(): readonly KnownJobType[] {
  return JOB_TYPES;
}
