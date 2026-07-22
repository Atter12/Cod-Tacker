import "server-only";

import { decryptSecret, encryptSecret, isEncryptedSecretRef } from "@/lib/crypto/secret-box";

export function packEcartPayApiToken(apiToken: string): string {
  return encryptSecret(apiToken.trim());
}

export function unpackEcartPayApiToken(secretRef: string): string {
  return decryptSecret(secretRef);
}

export function resolveEcartPayTokenFromIntegration(integration: {
  secret_reference?: string | null;
}): string | null {
  if (!isEncryptedSecretRef(integration.secret_reference)) return null;
  try {
    const token = unpackEcartPayApiToken(integration.secret_reference).trim();
    return token || null;
  } catch {
    return null;
  }
}

export function fingerprintEcartPayToken(token: string): string {
  let hash = 0;
  for (let i = 0; i < token.length; i += 1) {
    hash = (hash * 31 + token.charCodeAt(i)) | 0;
  }
  return `ecart:${(hash >>> 0).toString(16)}`;
}
