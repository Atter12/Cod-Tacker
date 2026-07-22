/**
 * Stable billing provider contract.
 * Domain limits / UI read persisted subscriptions — never call providers from Client Components.
 */

export type BillingProviderId =
  | "demo"
  | "stripe"
  | "paddle"
  | "culqi"
  | "mercadopago";

export type BillingInterval = "month" | "year";

/** Plans that may go through self-serve checkout (Agency / Enterprise = sales). */
export const BILLING_SELF_SERVE_PLAN_CODES = ["starter", "growth", "scale"] as const;
export type BillingSelfServePlanCode = (typeof BILLING_SELF_SERVE_PLAN_CODES)[number];

export function isSelfServePlanCode(code: string): code is BillingSelfServePlanCode {
  return (BILLING_SELF_SERVE_PLAN_CODES as readonly string[]).includes(code);
}

export type BillingCheckoutInput = {
  agencyId: string;
  agencySlug: string;
  planCode: string;
  interval: BillingInterval;
  successUrl: string;
  cancelUrl: string;
  customerEmail?: string | null;
  actorUserId?: string | null;
};

export type BillingCheckoutResult =
  | { kind: "redirect"; url: string }
  | { kind: "applied"; planCode: string };

export type BillingPortalInput = {
  agencyId: string;
  returnUrl: string;
};

export type BillingCancelInput = {
  agencyId: string;
  actorUserId?: string | null;
};

export type BillingReactivateInput = {
  agencyId: string;
  actorUserId?: string | null;
};

/** Provider-agnostic billing adapter (Stripe first; Paddle/Culqi/MP later). */
export interface BillingProvider {
  readonly providerId: BillingProviderId;
  readonly mode: "mock" | "live";

  createCheckoutSession(input: BillingCheckoutInput): Promise<BillingCheckoutResult>;

  createPortalSession(input: BillingPortalInput): Promise<{ url: string }>;

  cancelAtPeriodEnd(input: BillingCancelInput): Promise<void>;

  reactivate(input: BillingReactivateInput): Promise<void>;
}
