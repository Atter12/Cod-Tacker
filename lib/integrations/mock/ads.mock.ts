import type { AdsProvider } from "@/lib/integrations/contracts/ads";
import {
  mockConnectResult,
  mockHealthResult,
  mockSyncResult,
} from "@/lib/integrations/mock/scenario";

export function createMockAdsProvider(providerId: AdsProvider["providerId"] = "meta"): AdsProvider {
  return {
    providerId,
    mode: "mock",
    async connect(input) {
      return mockConnectResult({
        externalAccountId: input.accountExternalId || `act_mock_${providerId}`,
        displayName: `Mock Ads · ${providerId}`,
        credentialRef: input.credentialRef || `${providerId}-demo`,
      });
    },
    async health() {
      return mockHealthResult("success");
    },
    async sync(input) {
      return mockSyncResult(input);
    },
    async listSpend(dateRange) {
      return [
        {
          date: dateRange.from,
          campaignExternalId: `mock-campaign-${providerId}`,
          spend: 120.5,
          impressions: 10_000,
          clicks: 320,
          currency: "PEN",
        },
      ];
    },
  };
}
