"use server";

import { revalidatePath } from "next/cache";
import { actionFail, actionOk, type ActionResult } from "@/lib/actions/action-result";
import { writeAuditLog } from "@/lib/audit/write-audit";
import { requireUser } from "@/lib/auth/require-user";
import { getProductAppUrl } from "@/config/env";
import { routes } from "@/config/routes";
import { ValidationError } from "@/lib/errors";
import type { Role } from "@/config/permissions";
import { can } from "@/lib/permissions/can";
import {
  getBillingProviderForAgency,
  resolveAgencyBillingProviderId,
} from "@/lib/billing/provider";
import { syncShopifyAppPricingForAgency } from "@/lib/billing/shopify-subscription-sync";
import {
  canShowStripeTestModeToggle,
  resolveStripeKeyModeForUser,
  setStripeTestModeCookie,
} from "@/lib/billing/stripe-test-mode";
import {
  isStripeTestModeConfigured,
  isStripeTestModeEmailAllowed,
  resolveBillingProviderMode,
  type BillingProviderMode,
} from "@/lib/billing/env";
import type { BillingInterval } from "@/lib/integrations/contracts/billing";
import { createClient } from "@/lib/supabase/server";
import { requireAgencyAccess } from "@/lib/tenant/require-agency-access";

export type BillingActionResult = ActionResult<{
  planCode?: string;
  url?: string;
  kind?: "redirect" | "applied";
}>;

function assertBillingManage(roles: readonly Role[]) {
  if (!can(roles, "billing.manage")) {
    throw new ValidationError("No tienes permiso para gestionar la facturación.");
  }
}

function billingSuccessUrl(agencySlug: string): string {
  return `${getProductAppUrl()}${routes.agency.billing(agencySlug)}?checkout=success`;
}

function billingCancelUrl(agencySlug: string): string {
  return `${getProductAppUrl()}${routes.agency.billing(agencySlug)}?checkout=cancel`;
}

/**
 * Start plan selection: demo applies locally; Stripe opens Checkout; Shopify
 * redirects to the hosted App Pricing page.
 * @deprecated Prefer selectPlan — kept for BillingPanel compatibility.
 */
export async function changePlanMock(
  agencySlug: string,
  planCode: string,
): Promise<BillingActionResult> {
  return selectPlan(agencySlug, planCode, "month");
}

export async function selectPlan(
  agencySlug: string,
  planCode: string,
  interval: BillingInterval = "month",
): Promise<BillingActionResult> {
  try {
    const user = await requireUser();
    const membership = await requireAgencyAccess(agencySlug);
    assertBillingManage(membership.roles);

    const keyMode = await resolveStripeKeyModeForUser(user.email);
    const provider = await getBillingProviderForAgency(membership.agencyId, keyMode);
    const result = await provider.createCheckoutSession({
      agencyId: membership.agencyId,
      agencySlug,
      planCode,
      interval,
      successUrl: billingSuccessUrl(agencySlug),
      cancelUrl: billingCancelUrl(agencySlug),
      customerEmail: user.email,
      actorUserId: user.id,
    });

    await writeAuditLog({
      action: "billing_plan_changed",
      entityType: "subscription",
      entityId: membership.agencyId,
      actorId: user.id,
      agencyId: membership.agencyId,
      newData: {
        planCode,
        interval,
        provider: provider.providerId,
        kind: result.kind,
        stripe_key_mode: keyMode,
      },
    });

    revalidatePath(routes.agency.billing(agencySlug));
    revalidatePath(routes.agency.branding(agencySlug));

    if (result.kind === "redirect") {
      return actionOk({ planCode, url: result.url, kind: "redirect" });
    }
    return actionOk({ planCode: result.planCode, kind: "applied" });
  } catch (error) {
    return actionFail(error);
  }
}

export async function openBillingPortal(agencySlug: string): Promise<BillingActionResult> {
  try {
    const user = await requireUser();
    const membership = await requireAgencyAccess(agencySlug);
    assertBillingManage(membership.roles);

    const keyMode = await resolveStripeKeyModeForUser(user.email);
    const provider = await getBillingProviderForAgency(membership.agencyId, keyMode);
    const { url } = await provider.createPortalSession({
      agencyId: membership.agencyId,
      returnUrl: billingSuccessUrl(agencySlug),
    });

    await writeAuditLog({
      action: "billing_plan_changed",
      entityType: "subscription",
      entityId: membership.agencyId,
      actorId: user.id,
      agencyId: membership.agencyId,
      newData: { provider: provider.providerId, portal: true, stripe_key_mode: keyMode },
    });

    return actionOk({ url, kind: "redirect" });
  } catch (error) {
    return actionFail(error);
  }
}

export async function scheduleCancelAtPeriodEnd(agencySlug: string): Promise<BillingActionResult> {
  try {
    const user = await requireUser();
    const membership = await requireAgencyAccess(agencySlug);
    assertBillingManage(membership.roles);

    const keyMode = await resolveStripeKeyModeForUser(user.email);
    const provider = await getBillingProviderForAgency(membership.agencyId, keyMode);
    await provider.cancelAtPeriodEnd({
      agencyId: membership.agencyId,
      actorUserId: user.id,
    });

    await writeAuditLog({
      action: "billing_cancel_scheduled",
      entityType: "subscription",
      entityId: membership.agencyId,
      actorId: user.id,
      agencyId: membership.agencyId,
      newData: { provider: provider.providerId, stripe_key_mode: keyMode },
    });

    revalidatePath(routes.agency.billing(agencySlug));
    return actionOk();
  } catch (error) {
    return actionFail(error);
  }
}

export async function reactivateSubscriptionMock(agencySlug: string): Promise<BillingActionResult> {
  return reactivateSubscription(agencySlug);
}

export async function reactivateSubscription(agencySlug: string): Promise<BillingActionResult> {
  try {
    const user = await requireUser();
    const membership = await requireAgencyAccess(agencySlug);
    assertBillingManage(membership.roles);

    const keyMode = await resolveStripeKeyModeForUser(user.email);
    const provider = await getBillingProviderForAgency(membership.agencyId, keyMode);
    await provider.reactivate({
      agencyId: membership.agencyId,
      actorUserId: user.id,
    });

    await writeAuditLog({
      action: "billing_reactivated",
      entityType: "subscription",
      entityId: membership.agencyId,
      actorId: user.id,
      agencyId: membership.agencyId,
      newData: { provider: provider.providerId, stripe_key_mode: keyMode },
    });

    revalidatePath(routes.agency.billing(agencySlug));
    return actionOk();
  } catch (error) {
    return actionFail(error);
  }
}

/**
 * Pull latest Shopify App Pricing state into local subscriptions (console dual billing).
 */
export async function refreshShopifyBillingStatus(
  agencySlug: string,
): Promise<ActionResult<{ synced: boolean; detail: string }>> {
  try {
    const user = await requireUser();
    const membership = await requireAgencyAccess(agencySlug);
    assertBillingManage(membership.roles);

    const providerId = await resolveAgencyBillingProviderId(membership.agencyId);
    if (providerId === "stripe") {
      throw new ValidationError(
        "Esta agencia factura con Stripe. No se sincroniza App Pricing sobre una suscripción Stripe.",
      );
    }

    const client = await createClient();
    const { data: store } = await client
      .from("stores")
      .select("shopify_shop_domain")
      .eq("agency_id", membership.agencyId)
      .eq("is_active", true)
      .not("shopify_shop_domain", "is", null)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    const shopDomain = store?.shopify_shop_domain?.trim();
    if (!shopDomain) {
      throw new ValidationError(
        "Conecta una tienda Shopify antes de sincronizar el plan de App Pricing.",
      );
    }

    const result = await syncShopifyAppPricingForAgency({
      agencyId: membership.agencyId,
      shopDomain,
    });

    await writeAuditLog({
      action: "billing_plan_changed",
      entityType: "subscription",
      entityId: membership.agencyId,
      actorId: user.id,
      agencyId: membership.agencyId,
      newData: { provider: "shopify", sync: result },
    });

    revalidatePath(routes.agency.billing(agencySlug));
    revalidatePath(routes.agency.branding(agencySlug));

    if (result.kind === "synced") {
      return actionOk({
        synced: true,
        detail: `Plan sincronizado (${result.status}${result.planCode ? ` · ${result.planCode}` : ""}).`,
      });
    }
    if (result.kind === "cleared") {
      return actionOk({
        synced: true,
        detail: "Shopify ya no tiene contrato activo; la suscripción local quedó cancelada.",
      });
    }
    return actionOk({
      synced: false,
      detail:
        "reason" in result
          ? `Sin cambios (${result.reason}).`
          : "Sin cambios en el estado del plan.",
    });
  } catch (error) {
    return actionFail(error);
  }
}

/** Toggle Stripe test keys for allowlisted emails only. */
export async function setStripeTestMode(
  agencySlug: string,
  enabled: boolean,
): Promise<ActionResult<{ enabled: boolean }>> {
  try {
    const user = await requireUser();
    if (!isStripeTestModeEmailAllowed(user.email)) {
      throw new ValidationError("No tienes permiso para activar el modo test de Stripe.");
    }
    if (enabled && !isStripeTestModeConfigured()) {
      throw new ValidationError(
        "Falta STRIPE_TEST_SECRET_KEY en el servidor. Agrégala en Vercel y redespliega.",
      );
    }
    await setStripeTestModeCookie(enabled);
    revalidatePath(routes.agency.billing(agencySlug));
    return actionOk({ enabled });
  } catch (error) {
    return actionFail(error);
  }
}

/** Exposed for UI badges — not a secret. */
export async function getBillingProviderModeAction(
  agencySlug?: string,
): Promise<
  ActionResult<{
    mode: BillingProviderMode;
    stripeKeyMode: "live" | "test";
    canUseStripeTestMode: boolean;
  }>
> {
  try {
    const user = await requireUser();
    const stripeKeyMode = await resolveStripeKeyModeForUser(user.email);
    let mode: BillingProviderMode = resolveBillingProviderMode();
    if (agencySlug) {
      const membership = await requireAgencyAccess(agencySlug);
      mode = await resolveAgencyBillingProviderId(membership.agencyId);
    }
    return actionOk({
      mode,
      stripeKeyMode,
      canUseStripeTestMode: mode === "stripe" && canShowStripeTestModeToggle(user.email),
    });
  } catch (error) {
    return actionFail(error);
  }
}
