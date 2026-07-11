import type {
  ProviderConnectionResult,
  ProviderHealthResult,
  ProviderSyncInput,
  ProviderSyncResult,
} from "./common";

export type MessagingProviderId = "whatsapp" | "other";

export type MessagingSendResult = {
  externalId: string;
  to: string;
  status: string;
  sentAt: string | null;
};

/** Stable messaging (WhatsApp) provider contract. */
export interface MessagingProvider {
  readonly providerId: MessagingProviderId;
  readonly mode: "mock" | "live";
  connect(input: { phoneNumberId: string; credentialRef: string }): Promise<ProviderConnectionResult>;
  health(): Promise<ProviderHealthResult>;
  sync(input: ProviderSyncInput): Promise<ProviderSyncResult>;
  sendText?(to: string, body: string): Promise<MessagingSendResult>;
}
