import { createHmac } from "node:crypto";

const DEFAULT_TTL_SECONDS = 600;

function base64UrlEncode(value: string | Buffer): string {
  return Buffer.from(value).toString("base64url");
}

export function signPartnerEmailAssertion(input: {
  secret: string;
  externalStoreId: string;
  email: string;
  partnerId: string;
  emailVerifiedAt?: string | null;
  ttlSeconds?: number;
}): string {
  const secret = input.secret.trim();
  if (!secret) throw new Error("PARTNER_EMAIL_ASSERTION_SECRET requerido.");

  const now = Math.floor(Date.now() / 1000);
  const payload: Record<string, unknown> = {
    iss: input.partnerId,
    aud: "flipy",
    sub: input.externalStoreId.trim(),
    email: input.email.trim().toLowerCase(),
    partnerId: input.partnerId,
    exp: now + (input.ttlSeconds ?? DEFAULT_TTL_SECONDS),
  };
  if (input.emailVerifiedAt?.trim()) {
    payload.emailVerifiedAt = input.emailVerifiedAt.trim();
  }

  const header = base64UrlEncode(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const body = base64UrlEncode(JSON.stringify(payload));
  const signingInput = `${header}.${body}`;
  const signature = createHmac("sha256", secret).update(signingInput, "utf8").digest("base64url");
  return `${signingInput}.${signature}`;
}
