import type { Enums } from "@/types/database.generated";
import type {
  ProviderConnectionResult,
  ProviderHealthResult,
  ProviderSyncInput,
  ProviderSyncResult,
} from "./common";

export type AdsProviderId = Enums<"ad_platform">;

export type AdsSpendSnapshot = {
  date: string;
  /** Platform campaign id (Meta campaign_id / TikTok campaign_id). */
  campaignExternalId: string;
  /** Optional display name from Insights/report. */
  campaignName?: string;
  spend: number;
  impressions: number;
  clicks: number;
  currency: string;
};

/** Stable ads platform contract (Meta, TikTok, …). */
export interface AdsProvider {
  readonly providerId: AdsProviderId;
  readonly mode: "mock" | "live";
  connect(input: { accountExternalId: string; credentialRef: string }): Promise<ProviderConnectionResult>;
  health(): Promise<ProviderHealthResult>;
  sync(input: ProviderSyncInput): Promise<ProviderSyncResult>;
  listSpend?(dateRange: { from: string; to: string }): Promise<AdsSpendSnapshot[]>;
}
