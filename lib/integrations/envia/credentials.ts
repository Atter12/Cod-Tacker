import "server-only";

import { decryptSecret, encryptSecret, isEncryptedSecretRef } from "@/lib/crypto/secret-box";
import { getEnviaEnv, resolveEnviaApiToken } from "@/lib/integrations/envia/env";
import { fingerprintEnviaApiToken } from "@/lib/integrations/envia/token-fingerprint";

export { fingerprintEnviaApiToken };

export function packEnviaApiToken(apiToken: string): string {
  return encryptSecret(apiToken.trim());
}

export function unpackEnviaApiToken(secretReference: string): string {
  return decryptSecret(secretReference);
}

/** Prefer encrypted secret_reference, then settings/metadata, then ENVIA_API_TOKEN. */
export function resolveEnviaApiTokenFromIntegration(integration: {
  secret_reference?: string | null;
  settings?: unknown;
  metadata?: unknown;
}): string | null {
  if (isEncryptedSecretRef(integration.secret_reference)) {
    try {
      const token = unpackEnviaApiToken(integration.secret_reference).trim();
      if (token) return token;
    } catch {
      /* fall through */
    }
  }
  return resolveEnviaApiToken(integration.settings, integration.metadata) ?? getEnviaEnv().apiToken;
}

export function readTokenFingerprint(settings: unknown): string | null {
  if (!settings || typeof settings !== "object" || Array.isArray(settings)) return null;
  const fp = (settings as Record<string, unknown>).token_fingerprint;
  return typeof fp === "string" && /^[a-f0-9]{64}$/i.test(fp.trim()) ? fp.trim().toLowerCase() : null;
}
