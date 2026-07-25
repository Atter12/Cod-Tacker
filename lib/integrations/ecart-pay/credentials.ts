import "server-only";

import { decryptSecret, encryptSecret, isEncryptedSecretRef } from "@/lib/crypto/secret-box";
import {
  fingerprintEcartPayPublicKey,
  parseEcartPayStoredPlaintext,
  serializeEcartPayApiKeysPack,
  type EcartPayApiKeys,
  type EcartPayStoredCredentials,
} from "@/lib/integrations/ecart-pay/credentials-parse";

export type { EcartPayApiKeys, EcartPayStoredCredentials };
export { fingerprintEcartPayPublicKey };

/** Encrypt API keys for `integrations.secret_reference` (durable; Bearer is minted on demand). */
export function packEcartPayApiKeys(keys: EcartPayApiKeys): string {
  return encryptSecret(serializeEcartPayApiKeysPack(keys));
}

/** @deprecated Prefer packEcartPayApiKeys — stored Bearer expires ~1h. */
export function packEcartPayApiToken(apiToken: string): string {
  return encryptSecret(apiToken.trim());
}

export function unpackEcartPayStoredCredentials(secretRef: string): EcartPayStoredCredentials {
  return parseEcartPayStoredPlaintext(decryptSecret(secretRef));
}

export function resolveEcartPayCredentialsFromIntegration(integration: {
  secret_reference?: string | null;
}): EcartPayStoredCredentials | null {
  if (!isEncryptedSecretRef(integration.secret_reference)) return null;
  try {
    return unpackEcartPayStoredCredentials(integration.secret_reference);
  } catch {
    return null;
  }
}

/**
 * Resolve a usable Bearer for API calls.
 * - api_keys: mint a fresh ~1h token
 * - legacy_bearer: return stored token (may already be expired)
 */
export async function resolveEcartPayAccessTokenFromIntegration(integration: {
  secret_reference?: string | null;
}): Promise<{ token: string; source: "api_keys" | "legacy_bearer" } | null> {
  const creds = resolveEcartPayCredentialsFromIntegration(integration);
  if (!creds) return null;

  if (creds.kind === "api_keys") {
    const { createEcartPayAuthorizationToken } = await import("@/lib/integrations/ecart-pay/api");
    const token = await createEcartPayAuthorizationToken({
      publicKey: creds.publicKey,
      privateKey: creds.privateKey,
    });
    return { token, source: "api_keys" };
  }

  return { token: creds.token, source: "legacy_bearer" };
}

/** @deprecated Prefer resolveEcartPayAccessTokenFromIntegration. */
export function resolveEcartPayTokenFromIntegration(integration: {
  secret_reference?: string | null;
}): string | null {
  const creds = resolveEcartPayCredentialsFromIntegration(integration);
  if (!creds) return null;
  if (creds.kind === "legacy_bearer") return creds.token;
  return null;
}

/** @deprecated Prefer fingerprintEcartPayPublicKey. */
export function fingerprintEcartPayToken(token: string): string {
  return fingerprintEcartPayPublicKey(token);
}
