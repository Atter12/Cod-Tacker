export type WhatsAppRecipient = { phone: string; name?: string };
export type WhatsAppMessage = { externalId: string; to: string; body: string; status: string; sentAt: string | null };
export type WhatsAppTemplate = { name: string; language: string; variables: Record<string, string> };

/** Contract only: message delivery is performed by a provider adapter or background worker. */
export interface WhatsAppAdapter {
  validateConnection(): Promise<{ phoneNumberId: string }>;
  sendText(recipient: WhatsAppRecipient, body: string): Promise<WhatsAppMessage>;
  sendTemplate(recipient: WhatsAppRecipient, template: WhatsAppTemplate): Promise<WhatsAppMessage>;
}
