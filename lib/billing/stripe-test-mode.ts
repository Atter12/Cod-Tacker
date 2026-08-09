import "server-only";

import { cookies } from "next/headers";
import {
  isStripeTestModeConfigured,
  isStripeTestModeEmailAllowed,
  type StripeKeyMode,
} from "@/lib/billing/env";

const cookieName = "codtracked-stripe-test-mode";
const cookieOptions = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge: 60 * 60 * 24 * 7,
};

/**
 * Preference cookie only — callers must re-check email allowlist before honoring.
 */
export async function getStripeTestModeCookie(): Promise<boolean> {
  const store = await cookies();
  return store.get(cookieName)?.value === "1";
}

export async function setStripeTestModeCookie(enabled: boolean): Promise<void> {
  const store = await cookies();
  if (enabled) {
    store.set(cookieName, "1", cookieOptions);
  } else {
    store.delete(cookieName);
  }
}

/**
 * Resolve Stripe key mode for a signed-in user.
 * Cookie is ignored unless email is allowlisted and test keys exist.
 */
export async function resolveStripeKeyModeForUser(
  email: string | null | undefined,
): Promise<StripeKeyMode> {
  if (!isStripeTestModeEmailAllowed(email)) return "live";
  if (!isStripeTestModeConfigured()) return "live";
  if (!(await getStripeTestModeCookie())) return "live";
  return "test";
}

export function canShowStripeTestModeToggle(
  email: string | null | undefined,
): boolean {
  return isStripeTestModeEmailAllowed(email) && isStripeTestModeConfigured();
}

export function subscriptionLooksLikeStripeTest(
  metadata: Record<string, unknown> | null | undefined,
): boolean {
  return metadata?.stripe_key_mode === "test";
}
