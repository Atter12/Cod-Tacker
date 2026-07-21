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

  const base = resolveWhatsAppCredentials(integration.settings, integration.metadata);
  const phoneFromExternal =
    typeof integration.external_account_id === "string" && integration.external_account_id.trim()
      ? integration.external_account_id.trim()
      : null;

  if (tokenFromSecret && (base?.phoneNumberId || phoneFromExternal || getWhatsAppEnv().phoneNumberId)) {
    return {
      accessToken: tokenFromSecret,
      phoneNumberId: base?.phoneNumberId ?? phoneFromExternal ?? getWhatsAppEnv().phoneNumberId!,
      businessAccountId: base?.businessAccountId ?? getWhatsAppEnv().businessAccountId,
      apiVersion: base?.apiVersion ?? getWhatsAppEnv().apiVersion,
      confirmationTemplateName: base?.confirmationTemplateName ?? null,
      confirmationTemplateLanguage: base?.confirmationTemplateLanguage ?? "es",
      source: "integration",
    };
  }

  return base;
}
