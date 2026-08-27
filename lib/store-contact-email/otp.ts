import { createHash, randomInt, timingSafeEqual } from "node:crypto";

const OTP_TTL_MS = 1000 * 60 * 10; // 10 minutes

export function generateStoreContactOtpCode(): string {
  return String(randomInt(100_000, 1_000_000));
}

export function hashStoreContactOtpCode(input: {
  storeId: string;
  email: string;
  code: string;
}): string {
  const email = input.email.trim().toLowerCase();
  return createHash("sha256")
    .update(`${input.storeId}:${email}:${input.code.trim()}`, "utf8")
    .digest("hex");
}

export function verifyStoreContactOtpHash(input: {
  storeId: string;
  email: string;
  code: string;
  codeHash: string;
}): boolean {
  const expected = hashStoreContactOtpCode(input);
  const a = Buffer.from(expected, "utf8");
  const b = Buffer.from(input.codeHash, "utf8");
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export function storeContactOtpExpiresAt(from = Date.now()): string {
  return new Date(from + OTP_TTL_MS).toISOString();
}

export const STORE_CONTACT_OTP_TTL_MS = OTP_TTL_MS;
