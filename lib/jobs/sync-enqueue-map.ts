/**
 * Maps integration providers to mock job event types for enqueue after sync.
 */
import type { Database, Json } from "@/types/database.generated";

type Provider = Database["public"]["Enums"]["integration_provider"];

export type SyncEnqueueSpec = {
  eventType: string;
  jobType: string;
  action: "created" | "updated";
  payload: Json;
};

function metricDateIso(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Builds deterministic enqueue specs from a successful mock sync result.
 * Idempotency keys should include syncRunId + index (caller responsibility).
 */
export function buildSyncEnqueueSpecs(input: {
  provider: string;
  syncRunId: string;
  inserted: number;
  updated: number;
}): SyncEnqueueSpec[] {
  const provider = input.provider as Provider;
  const specs: SyncEnqueueSpec[] = [];
  const createdCount = Math.min(Math.max(input.inserted, 0), 5);
  const updatedCount = Math.min(Math.max(input.updated, 0), 3);

  switch (provider) {
    case "shopify": {
      for (let i = 0; i < createdCount; i += 1) {
        const externalId = `mock-shopify-order-${input.syncRunId.slice(0, 8)}-${i + 1}`;
        specs.push({
          eventType: "shopify.order.created.mock",
          jobType: "shopify.order.created.mock",
          action: "created",
          payload: {
            external_order_id: externalId,
            order_number: `COD-${i + 1}`,
            currency_code: "PEN",
            total_amount: 100 + i * 10,
            demo_seed: `${input.syncRunId}:created:${i + 1}`,
          },
        });
      }
      for (let i = 0; i < updatedCount; i += 1) {
        const externalId = `mock-shopify-order-${input.syncRunId.slice(0, 8)}-${i + 1}`;
        specs.push({
          eventType: "shopify.order.updated.mock",
          jobType: "shopify.order.updated.mock",
          action: "updated",
          payload: {
            external_order_id: externalId,
            order_status: "confirmed",
            demo_seed: `${input.syncRunId}:updated:${i + 1}`,
          },
        });
      }
      break;
    }
    case "meta":
    case "tiktok": {
      for (let i = 0; i < createdCount; i += 1) {
        specs.push({
          eventType: "ads.spend.synced.mock",
          jobType: "ads.spend.synced.mock",
          action: "created",
          payload: {
            platform: provider,
            external_account_id: `mock-account-${provider}`,
            metric_date: metricDateIso(),
            spend: 50 + i * 5,
            currency_code: "PEN",
            impressions: 1000 + i * 100,
            clicks: 20 + i,
            demo_seed: `${input.syncRunId}:ads:${i + 1}`,
          },
        });
      }
      break;
    }
    case "enviame":
    case "custom_carrier": {
      for (let i = 0; i < createdCount; i += 1) {
        specs.push({
          eventType: "carrier.shipment.updated.mock",
          jobType: "carrier.shipment.updated.mock",
          action: "created",
          payload: {
            tracking_number: `TRK-${input.syncRunId.slice(0, 8)}-${i + 1}`,
            status: "in_transit",
            external_event_id: `${input.syncRunId}:ship:${i + 1}`,
            demo_seed: `${input.syncRunId}:ship:${i + 1}`,
          },
        });
      }
      break;
    }
    case "whatsapp": {
      for (let i = 0; i < createdCount; i += 1) {
        specs.push({
          eventType: "whatsapp.message.received.mock",
          jobType: "whatsapp.message.received.mock",
          action: "created",
          payload: {
            phone: `+51999900${String(i).padStart(2, "0")}`,
            external_message_id: `wa-${input.syncRunId.slice(0, 8)}-${i + 1}`,
            body: "Mensaje mock de confirmación COD",
            demo_seed: `${input.syncRunId}:wa:${i + 1}`,
          },
        });
      }
      break;
    }
    case "custom_payment": {
      for (let i = 0; i < Math.max(createdCount, 1); i += 1) {
        specs.push({
          eventType: "settlement.batch.received.mock",
          jobType: "settlement.batch.received.mock",
          action: "created",
          payload: {
            external_batch_id: `batch-${input.syncRunId.slice(0, 8)}-${i + 1}`,
            gross_amount: 500 + i * 50,
            fees_amount: 20,
            currency_code: "PEN",
            demo_seed: `${input.syncRunId}:settle:${i + 1}`,
          },
        });
      }
      break;
    }
    default:
      break;
  }

  return specs;
}
