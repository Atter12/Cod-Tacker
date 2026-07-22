import { ValidationError } from "@/lib/errors";

/** Soft landing after cancel/expire before hard block. */
export const BILLING_CANCEL_GRACE_DAYS = 7;

/**
 * After Stripe marks past_due, allow limited continued use so the owner can
 * update the payment method via Customer Portal.
 */
export const BILLING_PAST_DUE_GRACE_DAYS = 7;

/** Minimal shape — avoid importing full PlanLimits (keeps client bundles clean). */
export type SubscriptionAccessInput = {
  subscriptionStatus: string;
  gracePeriodEndsAt: string | null;
  currentPeriodEnd: string | null;
  pastDueSince: string | null;
};

export type SubscriptionAccessCode =
  | "ok"
  | "no_subscription"
  | "past_due_grace"
  | "past_due_blocked"
  | "cancelled_grace"
  | "subscription_blocked";

export type SubscriptionAccessResult = {
  allowed: boolean;
  code: SubscriptionAccessCode;
  /** Safe Spanish message for UI / ValidationError. */
  message: string | null;
};

function addDaysIso(iso: string, days: number): string {
  return new Date(new Date(iso).getTime() + days * 86400000).toISOString();
}

function isFuture(iso: string | null | undefined, nowMs: number): boolean {
  if (!iso) return false;
  const t = new Date(iso).getTime();
  return Number.isFinite(t) && t > nowMs;
}

/**
 * Pure access policy for agency subscription status.
 * Used by assertSubscriptionAllowsAccess and Billing UI banners.
 */
export function evaluateSubscriptionAccess(
  limits: SubscriptionAccessInput | null,
  now: Date = new Date(),
): SubscriptionAccessResult {
  if (!limits) {
    return { allowed: true, code: "no_subscription", message: null };
  }

  const nowMs = now.getTime();
  const status = limits.subscriptionStatus;

  if (status === "active" || status === "trialing") {
    return { allowed: true, code: "ok", message: null };
  }

  if (status === "past_due") {
    const anchor =
      limits.pastDueSince ??
      limits.currentPeriodEnd ??
      // Fail closed only after grace from "now" if we lack anchors (first sync).
      now.toISOString();
    const graceEnds = addDaysIso(anchor, BILLING_PAST_DUE_GRACE_DAYS);
    if (isFuture(graceEnds, nowMs)) {
      return {
        allowed: true,
        code: "past_due_grace",
        message:
          "Hay un problema con el pago. Actualiza el método de pago para evitar la suspensión.",
      };
    }
    return {
      allowed: false,
      code: "past_due_blocked",
      message:
        "La suscripción está vencida por falta de pago. Actualiza el método de pago en Facturación o contacta a soporte.",
    };
  }

  if (status === "cancelled" || status === "expired" || status === "paused") {
    if (isFuture(limits.gracePeriodEndsAt, nowMs)) {
      return {
        allowed: true,
        code: "cancelled_grace",
        message:
          "La suscripción está programada para terminar. Aún tienes acceso durante el período de gracia.",
      };
    }
    return {
      allowed: false,
      code: "subscription_blocked",
      message:
        "La suscripción de la agencia está suspendida o cancelada. Contacta a facturación o al administrador.",
    };
  }

  // Unknown statuses → restrictive
  return {
    allowed: false,
    code: "subscription_blocked",
    message:
      "La suscripción de la agencia no permite esta acción. Revisa Facturación.",
  };
}

export function assertSubscriptionAllowsAccess(
  limits: SubscriptionAccessInput | null,
  now: Date = new Date(),
): void {
  const result = evaluateSubscriptionAccess(limits, now);
  if (result.allowed) return;
  throw new ValidationError(
    result.message ??
      "La suscripción de la agencia está suspendida o cancelada. Contacta a facturación o al administrador.",
  );
}

/** Compute default cancel grace end from period end (or now). */
export function defaultCancelGraceEndsAt(
  currentPeriodEnd: string | null,
  now: Date = new Date(),
): string {
  const base = currentPeriodEnd ?? now.toISOString();
  return addDaysIso(base, BILLING_CANCEL_GRACE_DAYS);
}
