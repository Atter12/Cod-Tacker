import type { SettlementProvider } from "@/lib/integrations/contracts/settlement-provider";
import {
  mockConnectResult,
  mockHealthResult,
  mockSyncResult,
} from "@/lib/integrations/mock/scenario";

export function createMockSettlementProvider(
  providerId: SettlementProvider["providerId"] = "custom_payment",
): SettlementProvider {
  return {
    providerId,
    mode: "mock",
    async connect(input) {
      return mockConnectResult({
        externalAccountId: `settlement-${providerId}`,
        displayName: `Mock Settlement · ${providerId}`,
        credentialRef: input.credentialRef || `${providerId}-demo`,
      });
    },
    async health() {
      return mockHealthResult("success");
    },
    async sync(input) {
      return mockSyncResult(input);
    },
    async listBatches() {
      return [
        {
          externalId: "mock-batch-001",
          currency: "PEN",
          grossAmount: 1_000,
          feeAmount: 30,
          netAmount: 970,
          settledAt: null,
        },
      ];
    },
  };
}
