import type { Enums } from "@/types/database.generated";
import type {
  ProviderConnectionResult,
  ProviderHealthResult,
  ProviderSyncInput,
  ProviderSyncResult,
} from "./common";

export type CommerceProviderId = Extract<Enums<"integration_provider">, "shopify" | "other">;

export type CommerceOrderSnapshot = {
  externalId: string;
  orderNumber: string;
  currency: string;
  total: number;
  createdAt: string;
  updatedAt: string;
};

/** Stable commerce (e.g. Shopify) provider contract. */
export interface CommerceProvider {
  readonly providerId: CommerceProviderId;
  readonly mode: "mock" | "live";
  connect(input: { shopDomain: string; credentialRef: string }): Promise<ProviderConnectionResult>;
  health(): Promise<ProviderHealthResult>;
  sync(input: ProviderSyncInput): Promise<ProviderSyncResult>;
  listOrders?(since?: string): Promise<CommerceOrderSnapshot[]>;
}
