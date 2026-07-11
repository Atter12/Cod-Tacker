import type { MessagingProvider } from "@/lib/integrations/contracts/messaging";
import {
  mockConnectResult,
  mockHealthResult,
  mockNowIso,
  mockSyncResult,
} from "@/lib/integrations/mock/scenario";

export function createMockMessagingProvider(
  providerId: MessagingProvider["providerId"] = "whatsapp",
): MessagingProvider {
  return {
    providerId,
    mode: "mock",
    async connect(input) {
      return mockConnectResult({
        externalAccountId: input.phoneNumberId || "mock-phone-number",
        displayName: "Mock WhatsApp",
        credentialRef: input.credentialRef || "whatsapp-demo",
      });
    },
    async health() {
      return mockHealthResult("success");
    },
    async sync(input) {
      return mockSyncResult(input);
    },
    async sendText(to, body) {
      void body;
      return {
        externalId: `mock-msg-${to.replace(/\D/g, "").slice(-6) || "000000"}`,
        to,
        status: "sent",
        sentAt: mockNowIso(`wa-${to}`),
      };
    },
  };
}
