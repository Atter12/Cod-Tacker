import "server-only";

import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { getServerEnv } from "@/config/env";

const PREFIX = "enc:v1:";

function resolveKey(raw: string): Buffer {
  const trimmed = raw.trim();
  if (/^[0-9a-fA-F]{64}$/.test(trimmed)) return Buffer.from(trimmed, "hex");
  try {
    const asB64 = Buffer.from(trimmed, "base64");
    if (asB64.length === 32) return asB64;
  } catch {
    /* fall through */
  }
  return createHash("sha256").update(trimmed, "utf8").digest();
}

function requireEncryptionKey(): Buffer {
  const key = getServerEnv().ENCRYPTION_KEY;
  if (!key) {
    throw new Error("ENCRYPTION_KEY is required to store Shopify credentials securely.");
  }
  return resolveKey(key);
}

/** Encrypt a UTF-8 secret. Output: `enc:v1:<base64(iv|tag|ciphertext)>`. */
export function encryptSecret(plaintext: string): string {
  const key = requireEncryptionKey();
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  const packed = Buffer.concat([iv, tag, ciphertext]);
  return `${PREFIX}${packed.toString("base64url")}`;
}

export function decryptSecret(payload: string): string {
  if (!payload.startsWith(PREFIX)) {
    throw new Error("Unsupported secret reference format.");
  }
  const key = requireEncryptionKey();
  const packed = Buffer.from(payload.slice(PREFIX.length), "base64url");
  if (packed.length < 12 + 16 + 1) throw new Error("Corrupt secret payload.");
  const iv = packed.subarray(0, 12);
  const tag = packed.subarray(12, 28);
  const ciphertext = packed.subarray(28);
  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
}

export function isEncryptedSecretRef(value: string | null | undefined): boolean {
  return typeof value === "string" && value.startsWith(PREFIX);
}
