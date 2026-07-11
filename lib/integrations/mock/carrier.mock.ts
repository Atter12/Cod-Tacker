import type { CarrierProvider } from "@/lib/integrations/contracts/carrier-provider";
import {
  mockConnectResult,
  mockHealthResult,
  mockNowIso,
  mockSyncResult,
} from "@/lib/integrations/mock/scenario";

export function createMockCarrierProvider(
  providerId: CarrierProvider["providerId"] = "enviame",
): CarrierProvider {
  return {
    providerId,
    mode: "mock",
    async connect(input) {
      return mockConnectResult({
        externalAccountId: `carrier-${providerId}`,
        displayName: `Mock Carrier · ${providerId}`,
        credentialRef: input.credentialRef || `${providerId}-demo`,
      });
    },
    async health() {
      return mockHealthResult("success");
    },
    async sync(input) {
      return mockSyncResult(input);
    },
    async getTracking(trackingNumber) {
      return {
        trackingNumber,
        status: "in_transit",
        occurredAt: mockNowIso(`track-${trackingNumber}`),
        description: "Evento mock de seguimiento",
      };
    },
  };
}
