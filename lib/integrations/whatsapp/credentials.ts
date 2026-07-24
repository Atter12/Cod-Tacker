import "server-only";

import { decryptSecret, encryptSecret, isEncryptedSecretRef } from "@/lib/crypto/secret-box";
import {
  getWhatsAppEnv,
  resolveWhatsAppCredentials,
  type WhatsAppCredentials,
} from "@/lib/integrations/whatsapp/env";

export function packWhatsAppAccessToken(accessToken: string): string {
  return encryptSecret(accessToken.trim());
}

export function unpackWhatsAppAccessToken(secretReference: string): string {
  return decryptSecret(secretReference);
}

/**
 * Prefer encrypted secret_reference, then settings/metadata token, then env.
 */
function readSettingsString(settings: unknown, metadata: unknown, ...keys: string[]): string | null {
  const bags: Record<string, unknown>[] = [];
  if (settings && typeof settings === "object" && !Array.isArray(settings)) {
    bags.push(settings as Record<string, unknown>);
  }
  if (metadata && typeof metadata === "object" && !Array.isArray(metadata)) {
    bags.push(metadata as Record<string, unknown>);
  }
  for (const bag of bags) {
    for (const key of keys) {
      const raw = bag[key];
      if (typeof raw === "string" && raw.trim()) return raw.trim();
    }
  }
  return null;
}

export function resolveWhatsAppCredentialsFromIntegration(integration: {
  secret_reference?: string | null;
  settings?: unknown;
  metadata?: unknown;
  external_account_id?: string | null;
}): WhatsAppCredentials | null {
  let tokenFromSecret: string | null = null;
  if (isEncryptedSecretRef(integration.secret_reference)) {
    try {
      const t = unpackWhatsAppAccessToken(integration.secret_reference).trim();
      if (t) tokenFromSecret = t;
    } catch {
      /* fall through */
    }
  }

  // Token lives in secret_reference (not settings) after connect — still read phone/template from settings.
  const base = resolveWhatsAppCredentials(integration.settings, integration.metadata);
  const phoneFromSettings = readSettingsString(
    integration.settings,
    integration.metadata,
    "phone_number_id",
    "phoneNumberId",
    "WHATSAPP_PHONE_NUMBER_ID",
  );
  const phoneFromExternal =
    typeof integration.external_account_id === "string" && integration.external_account_id.trim()
      ? integration.external_account_id.trim()
      : null;
  const templateFromSettings = readSettingsString(
    integration.settings,
    integration.metadata,
    "confirmation_template_name",
    "confirmation_template",
  );
  const templateLangFromSettings = readSettingsString(
    integration.settings,
    integration.metadata,
    "confirmation_template_language",
    "template_language",
  );

  if (tokenFromSecret && (base?.phoneNumberId || phoneFromSettings || phoneFromExternal || getWhatsAppEnv().phoneNumberId)) {
    const env = getWhatsAppEnv();
    return {
      accessToken: tokenFromSecret,
      phoneNumberId:
        base?.phoneNumberId ?? phoneFromSettings ?? phoneFromExternal ?? env.phoneNumberId!,
      businessAccountId: base?.businessAccountId ?? env.businessAccountId,
      apiVersion: base?.apiVersion ?? env.apiVersion,
      confirmationTemplateName:
        base?.confirmationTemplateName ??
        templateFromSettings ??
        readTrimmedEnv("WHATSAPP_CONFIRMATION_TEMPLATE"),
      confirmationTemplateLanguage:
        base?.confirmationTemplateLanguage ??
        templateLangFromSettings ??
        readTrimmedEnv("WHATSAPP_CONFIRMATION_TEMPLATE_LANG") ??
        "es",
      source: "integration",
    };
  }

  return base;
}

function readTrimmedEnv(name: string): string | null {
  const raw = process.env[name];
  if (typeof raw === "string" && raw.trim()) return raw.trim();
  return null;
}
