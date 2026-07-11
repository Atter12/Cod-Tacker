import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

/** Visible prefix length (never the secret). */
export const API_KEY_PREFIX_LEN = 8;
/** Secret body length in bytes (hex-encoded → 2× chars). */
export const API_KEY_SECRET_BYTES = 24;

export const API_KEY_SCOPES = [
  "orders.read",
  "orders.write",
  "shipments.read",
  "webhooks.write",
  "analytics.read",
] as const;

export type ApiKeyScope = (typeof API_KEY_SCOPES)[number];

export type GeneratedApiKey = {
  /** Full secret shown once: `ctk_` + prefix + `_` + secret */
  plaintext: string;
  keyPrefix: string;
  keyHash: string;
};

export function hashApiKey(plaintext: string): string {
  return createHash("sha256").update(plaintext, "utf8").digest("hex");
}

export function generateApiKey(): GeneratedApiKey {
  const prefix = randomBytes(API_KEY_PREFIX_LEN / 2).toString("hex");
  const secret = randomBytes(API_KEY_SECRET_BYTES).toString("hex");
  const plaintext = `ctk_${prefix}_${secret}`;
  return {
    plaintext,
    keyPrefix: prefix,
    keyHash: hashApiKey(plaintext),
  };
}

/**
 * Constant-time compare of a candidate key against a stored SHA-256 hex hash.
 */
export function verifyApiKey(plaintext: string, storedHash: string): boolean {
  const candidate = hashApiKey(plaintext);
  try {
    const a = Buffer.from(candidate, "hex");
    const b = Buffer.from(storedHash, "hex");
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

export function isAllowedScope(scope: string): scope is ApiKeyScope {
  return (API_KEY_SCOPES as readonly string[]).includes(scope);
}

export function sanitizeApiKeyRow<T extends { key_hash?: string }>(row: T): Omit<T, "key_hash"> {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { key_hash, ...rest } = row;
  return rest;
}
