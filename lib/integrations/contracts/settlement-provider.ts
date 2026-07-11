import type {
  ProviderConnectionResult,
  ProviderHealthResult,
  ProviderSyncInput,
  ProviderSyncResult,
} from "./common";

export type SettlementProviderId = "custom_payment" | "other";

export type SettlementBatchSnapshot = {
  externalId: string;
  currency: string;
  grossAmount: number;
  feeAmount: number;
  netAmount: number;
  settledAt: string | null;
};

/** Stable settlement / payment reconciliation provider contract. */
export interface SettlementProvider {
  readonly providerId: SettlementProviderId;
  readonly mode: "mock" | "live";
  connect(input: { credentialRef: string }): Promise<ProviderConnectionResult>;
  health(): Promise<ProviderHealthResult>;
  sync(input: ProviderSyncInput): Promise<ProviderSyncResult>;
  listBatches?(dateRange: { from: string; to: string }): Promise<SettlementBatchSnapshot[]>;
}
