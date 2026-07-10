import type { Enums } from "@/types/database.generated";

export type AdAccount = { externalId: string; name: string; currency: string | null; timezone: string | null; status: string | null };
export type AdCampaign = { externalId: string; accountExternalId: string; name: string; status: string | null; objective: string | null };
export type AdSpend = { date: string; accountExternalId: string; campaignExternalId?: string; spend: number; impressions: number; clicks: number; conversions: number; conversionValue: number; currency: string };
export type ConversionPayload = { eventName: string; occurredAt: string; orderId?: string; value?: number; currency?: string; clickId?: string; metadata?: Record<string, unknown> };

/** Contract only: concrete platform credentials and network calls are supplied by worker adapters. */
export interface AdPlatformAdapter {
  readonly platform: Enums<"ad_platform">;
  getAccounts(): Promise<AdAccount[]>;
  getCampaigns(accountExternalId: string): Promise<AdCampaign[]>;
  getSpend(accountExternalId: string, dateRange: { from: string; to: string }): Promise<AdSpend[]>;
  sendConversion(conversion: ConversionPayload): Promise<{ externalId: string }>;
}
