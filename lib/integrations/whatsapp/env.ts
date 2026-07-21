import "server-only";

/**
 * WhatsApp Cloud API (Business) — server env.
 *
 * Prefer per-store integration settings + encrypted secret_reference.
 * Vercel fallbacks (Preview/Production, server-only):
 *   WHATSAPP_ACCESS_TOKEN       — Cloud API permanent / system user token
 *   WHATSAPP_PHONE_NUMBER_ID    — Graph phone_number_id
 *   WHATSAPP_BUSINESS_ACCOUNT_ID — optional WABA id
 *   WHATSAPP_APP_SECRET         — app secret for X-Hub-Signature-256 (required in Production)
 *   WHATSAPP_VERIFY_TOKEN       — webhook hub.verify_token (required for GET challenge)
 *   WHATSAPP_API_VERSION        — optional; default v21.0
 *   WHATSAPP_WEBHOOK_REQUIRE_SECRET=true — force signature even outside Production
 *   WHATSAPP_WEBHOOK_ALLOW_OPEN=true     — emergency open auth in Production
 *
 * Webhook URL (Meta App → WhatsApp → Configuration):
 *   {NEXT_PUBLIC_APP_URL}/api/integrations/whatsapp/webhooks
 *
 * Docs: https://developers.facebook.com/docs/whatsapp/cloud-api
 */

function readTrimmed(name: string): string | null {
  const raw = process.env[name];
  if (typeof raw === "string" && raw.trim()) return raw.trim();
  return null;
}

function readString(bag: Record<string, unknown>, ...keys: string[]): string | null {
  for (const key of keys) {
    const raw = bag[key];
    if (typeof raw === "string" && raw.trim()) return raw.trim();
    if (typeof raw === "number" && Number.isFinite(raw)) return String(raw);
  }
  return null;
}

export const WHATSAPP_MISSING_CREDENTIALS_ERROR =
  "missing_whatsapp_credentials: set WHATSAPP_ACCESS_TOKEN + WHATSAPP_PHONE_NUMBER_ID (Vercel) or access_token + phone_number_id on the store whatsapp integration";

export type WhatsAppEnv = {
  accessToken: string | null;
  phoneNumberId: string | null;
  businessAccountId: string | null;
  appSecret: string | null;
  verifyToken: string | null;
  apiVersion: string;
};

export type WhatsAppCredentials = {
  accessToken: string;
  phoneNumberId: string;
  businessAccountId: string | null;
  apiVersion: string;
  /** Meta template name for COD confirmation (optional). */
  confirmationTemplateName: string | null;
  confirmationTemplateLanguage: string;
  source: "integration" | "env";
};

export function getWhatsAppEnv(): WhatsAppEnv {
  return {
    accessToken: readTrimmed("WHATSAPP_ACCESS_TOKEN"),
    phoneNumberId: readTrimmed("WHATSAPP_PHONE_NUMBER_ID"),
    businessAccountId: readTrimmed("WHATSAPP_BUSINESS_ACCOUNT_ID"),
    appSecret: readTrimmed("WHATSAPP_APP_SECRET"),
    verifyToken: readTrimmed("WHATSAPP_VERIFY_TOKEN"),
    apiVersion: readTrimmed("WHATSAPP_API_VERSION") ?? "v21.0",
  };
}

export function readWhatsAppCredentialsFromEnv(): Omit<WhatsAppCredentials, "source"> | null {
  const env = getWhatsAppEnv();
  if (!env.accessToken || !env.phoneNumberId) return null;
  return {
    accessToken: env.accessToken,
    phoneNumberId: env.phoneNumberId,
    businessAccountId: env.businessAccountId,
    apiVersion: env.apiVersion,
    confirmationTemplateName: readTrimmed("WHATSAPP_CONFIRMATION_TEMPLATE"),
    confirmationTemplateLanguage: readTrimmed("WHATSAPP_CONFIRMATION_TEMPLATE_LANG") ?? "es",
  };
}

export function readWhatsAppCredentials(
  settings: unknown,
  metadata: unknown,
): Omit<WhatsAppCredentials, "source"> | null {
  const bags: Record<string, unknown>[] = [];
  if (settings && typeof settings === "object" && !Array.isArray(settings)) {
    bags.push(settings as Record<string, unknown>);
  }
  if (metadata && typeof metadata === "object" && !Array.isArray(metadata)) {
    bags.push(metadata as Record<string, unknown>);
  }

  let accessToken: string | null = null;
  let phoneNumberId: string | null = null;
  let businessAccountId: string | null = null;
  let confirmationTemplateName: string | null = null;
  let confirmationTemplateLanguage: string | null = null;

  for (const bag of bags) {
    accessToken =
      accessToken ??
      readString(bag, "access_token", "whatsapp_access_token", "WHATSAPP_ACCESS_TOKEN");
    phoneNumberId =
      phoneNumberId ??
      readString(bag, "phone_number_id", "phoneNumberId", "WHATSAPP_PHONE_NUMBER_ID");
    businessAccountId =
      businessAccountId ??
      readString(bag, "business_account_id", "waba_id", "WHATSAPP_BUSINESS_ACCOUNT_ID");
    confirmationTemplateName =
      confirmationTemplateName ??
      readString(bag, "confirmation_template_name", "confirmation_template");
    confirmationTemplateLanguage =
      confirmationTemplateLanguage ??
      readString(bag, "confirmation_template_language", "template_language");
  }

  if (!accessToken || !phoneNumberId) return null;
  const env = getWhatsAppEnv();
  return {
    accessToken,
    phoneNumberId,
    businessAccountId: businessAccountId ?? env.businessAccountId,
    apiVersion: env.apiVersion,
    confirmationTemplateName:
      confirmationTemplateName ?? readTrimmed("WHATSAPP_CONFIRMATION_TEMPLATE"),
    confirmationTemplateLanguage:
      confirmationTemplateLanguage ??
      readTrimmed("WHATSAPP_CONFIRMATION_TEMPLATE_LANG") ??
      "es",
  };
}

export function resolveWhatsAppCredentials(
  settings: unknown,
  metadata: unknown,
): WhatsAppCredentials | null {
  const fromIntegration = readWhatsAppCredentials(settings, metadata);
  if (fromIntegration) return { ...fromIntegration, source: "integration" };
  const fromEnv = readWhatsAppCredentialsFromEnv();
  if (fromEnv) return { ...fromEnv, source: "env" };
  return null;
}
