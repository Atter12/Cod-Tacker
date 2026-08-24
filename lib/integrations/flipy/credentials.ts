import "server-only";

import { createHmac, randomBytes } from "node:crypto";
import { decryptSecret, encryptSecret, isEncryptedSecretRef } from "@/lib/crypto/secret-box";
import { getFlipyEnv } from "@/lib/integrations/flipy/env";

export type FlipyStoredCredentials = {
  partnerApiKey: string;
  flipyTiendaId?: string | null;
};

export function packFlipyPartnerKey(partnerApiKey: string): string {
  return encryptSecret(partnerApiKey.trim());
}

export function unpackFlipyPartnerKey(secretReference: string): string {
  return decryptSecret(secretReference);
}

export function generateFlipyWebhookSecret(): string {
  return randomBytes(32).toString("hex");
}

export function packFlipyWebhookSecret(secret: string): string {
  return encryptSecret(secret.trim());
}

export function unpackFlipyWebhookSecret(secretReference: string): string {
  return decryptSecret(secretReference);
}

export function fingerprintFlipyPartnerKey(partnerApiKey: string): string {
  return createHmac("sha256", "flipy-partner-key-fp")
    .update(partnerApiKey.trim())
    .digest("hex");
}

export function resolveFlipyPartnerKeyFromIntegration(integration: {
  secret_reference?: string | null;
  settings?: unknown;
  metadata?: unknown;
}): string | null {
  if (isEncryptedSecretRef(integration.secret_reference)) {
    try {
      const key = unpackFlipyPartnerKey(integration.secret_reference).trim();
      if (key) return key;
    } catch {
      /* fall through */
    }
  }

  const bags: Record<string, unknown>[] = [];
  if (integration.settings && typeof integration.settings === "object" && !Array.isArray(integration.settings)) {
    bags.push(integration.settings as Record<string, unknown>);
  }
  if (integration.metadata && typeof integration.metadata === "object" && !Array.isArray(integration.metadata)) {
    bags.push(integration.metadata as Record<string, unknown>);
  }
  for (const bag of bags) {
    for (const key of ["partner_api_key", "FLIPY_PARTNER_API_KEY", "api_key"]) {
      const v = bag[key];
      if (typeof v === "string" && v.trim()) return v.trim();
    }
  }

  return getFlipyEnv().partnerApiKey;
}

export function readFlipyTiendaId(settings: unknown): string | null {
  if (!settings || typeof settings !== "object" || Array.isArray(settings)) return null;
  const bag = settings as Record<string, unknown>;
  const id = bag.flipy_tienda_id ?? bag.flipyTiendaId;
  return typeof id === "string" && id.trim() ? id.trim() : null;
}

export function readFlipyWebhookSecretRef(settings: unknown): string | null {
  if (!settings || typeof settings !== "object" || Array.isArray(settings)) return null;
  const bag = settings as Record<string, unknown>;
  const ref = bag.webhook_secret_ref ?? bag.webhookSecretRef;
  return typeof ref === "string" && ref.trim() ? ref.trim() : null;
}
