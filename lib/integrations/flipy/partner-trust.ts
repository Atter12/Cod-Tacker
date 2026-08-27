import "server-only";

import { IntegrationError } from "@/lib/errors";
import { getFlipyEnv } from "@/lib/integrations/flipy/env";
import { signPartnerEmailAssertion } from "@/lib/integrations/flipy/partner-email-assertion";

export function getPartnerEmailAssertionSecret(): string | null {
  const primary = process.env.PARTNER_EMAIL_ASSERTION_SECRET?.trim();
  if (primary) return primary;
  return process.env.PARTNER_WIDGET_JWT_SECRET?.trim() ?? null;
}

export function requirePartnerEmailAssertionSecret(): string {
  const secret = getPartnerEmailAssertionSecret();
  if (!secret) {
    throw new IntegrationError(
      "PARTNER_EMAIL_ASSERTION_SECRET no configurada en el servidor. Debe coincidir con Flipy (v0.2.1 email trust).",
    );
  }
  return secret;
}

export function buildPartnerEmailAssertion(input: {
  externalStoreId: string;
  email: string;
  emailVerifiedAt?: string | null;
}): string {
  const env = getFlipyEnv();
  return signPartnerEmailAssertion({
    secret: requirePartnerEmailAssertionSecret(),
    externalStoreId: input.externalStoreId,
    email: input.email,
    partnerId: env.partnerId,
    emailVerifiedAt: input.emailVerifiedAt,
  });
}

export type StorePartnerEmailTrust = {
  emailVerifiedAt: string;
  partnerEmailAssertion: string;
};

export function buildStorePartnerEmailTrust(input: {
  externalStoreId: string;
  email: string;
  emailVerifiedAt: string | null | undefined;
}): StorePartnerEmailTrust | null {
  if (!input.emailVerifiedAt?.trim()) return null;
  return {
    emailVerifiedAt: input.emailVerifiedAt.trim(),
    partnerEmailAssertion: buildPartnerEmailAssertion({
      externalStoreId: input.externalStoreId,
      email: input.email,
      emailVerifiedAt: input.emailVerifiedAt,
    }),
  };
}
