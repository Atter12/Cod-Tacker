import type {
  ProviderConnectionResult,
  ProviderHealthResult,
  ProviderSyncInput,
  ProviderSyncResult,
} from "./common";

export type CarrierProviderId = "enviame" | "envia_com" | "custom_carrier" | "other";

export type CarrierTrackingSnapshot = {
  trackingNumber: string;
  status: string;
  occurredAt: string;
  description?: string;
};

/** Stable carrier / logistics provider contract. */
export interface CarrierProvider {
  readonly providerId: CarrierProviderId;
  readonly mode: "mock" | "live";
  connect(input: { credentialRef: string }): Promise<ProviderConnectionResult>;
  health(): Promise<ProviderHealthResult>;
  sync(input: ProviderSyncInput): Promise<ProviderSyncResult>;
  getTracking?(trackingNumber: string): Promise<CarrierTrackingSnapshot | null>;
}
