import type {
  ProviderConnectionResult,
  ProviderHealthResult,
  ProviderSyncInput,
  ProviderSyncResult,
} from "@/lib/integrations/contracts/common";
import type { SettlementProvider } from "@/lib/integrations/contracts/settlement-provider";

/**
 * Live settlement adapters for CSV upload + Ecart Pay.
 * Ingestion runs via jobs (`settlement.csv.imported` / `settlement.ecart.synced`),
 * not via listBatches — this provider exists so the registry matches production.
 */
export function createLiveSettlementProvider(
  providerId: SettlementProvider["providerId"] = "csv_upload",
): SettlementProvider {
  const label =
    providerId === "ecart_pay"
      ? "Ecart Pay"
      : providerId === "csv_upload"
        ? "CSV settlement"
        : `Settlement · ${providerId}`;

  return {
    providerId,
    mode: "live",
    async connect(input): Promise<ProviderConnectionResult> {
      return {
        ok: true,
        mode: "live",
        externalAccountId: `${providerId}-live`,
        displayName: label,
        credentialRef: input.credentialRef || `${providerId}-live`,
      };
    },
    async health(): Promise<ProviderHealthResult> {
      return {
        status: "healthy",
        mode: "live",
        checkedAt: new Date().toISOString(),
        latencyMs: 0,
        message: `${label}: ingest via settlement jobs (CSV upload / Ecart sync).`,
        demo: false,
      };
    },
    async sync(_input: ProviderSyncInput): Promise<ProviderSyncResult> {
      return {
        ok: true,
        mode: "live",
        processed: 0,
        inserted: 0,
        updated: 0,
        duplicates: 0,
        nextCursor: null,
        durationMs: 0,
        demo: false,
        enqueues: [],
      };
    },
    async listBatches() {
      return [];
    },
  };
}
