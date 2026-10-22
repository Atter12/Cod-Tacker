import "server-only";

import { mergeSubscriptionBillingMetadata } from "@/lib/billing/subscription-metadata";
import { normalizeShopifyShopGid } from "@/lib/billing/shopify-gids";
import {
  mapShopifyAppSubscription,
  pickCurrentAppSubscription,
} from "@/lib/billing/shopify-subscription-map";
import { isEncryptedSecretRef } from "@/lib/crypto/secret-box";
import { fetchShopifyAppSubscriptions } from "@/lib/integrations/shopify/app-subscription";
import { ensureShopifyAccessToken } from "@/lib/integrations/shopify/credentials";
import { logger } from "@/lib/observability/logger";
import { createAdminClient } from "@/lib/supabase/admin";
import type { DatabaseClient } from "@/services/_shared";
import type { Enums, Json } from "@/types/database.generated";

export type ShopifySubscriptionSyncResult =
  | { kind: "skipped"; reason: string }
  | {
      kind: "synced";
      status: string;
      planCode: string | null;
      subscriptionId: string;
    }
  | { kind: "cleared"; subscriptionId: string }
  | { kind: "unchanged"; reason: string };

export type ShopifyBillingSweepResult = {
  scanned: number;
  synced: number;
  cleared: number;
  skipped: number;
  errors: number;
  results: Array<{
    agencyId: string;
    shopDomain: string;
    outcome: ShopifySubscriptionSyncResult["kind"] | "error";
    detail?: string;
  }>;
};

async function loadAgencySubscription(
  admin: DatabaseClient,
  agencyId: string,
): Promise<{
  id: string;
  plan_id: string;
  billing_provider: string | null;
  metadata: Json;
} | null> {
  const { data, error } = await admin
    .from("subscriptions")
    .select("id, plan_id, billing_provider, metadata")
    .eq("agency_id", agencyId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data;
}

/** Connected Shopify integration of the agency's store for this shop (token holder). */
async function loadShopIntegration(
  admin: DatabaseClient,
  input: { agencyId: string; shopDomain: string },
) {
  const { data: store, error: storeError } = await admin
    .from("stores")
    .select("id")
    .eq("agency_id", input.agencyId)
    .eq("shopify_shop_domain", input.shopDomain)
    .limit(1)
    .maybeSingle();
  if (storeError) throw storeError;
  if (!store) return null;

  const { data: integration, error } = await admin
    .from("integrations")
    .select("id, agency_id, store_id, external_account_id, secret_reference, status, settings, metadata")
    .eq("agency_id", input.agencyId)
    .eq("store_id", store.id)
    .eq("provider", "shopify")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  if (
    !integration ||
    integration.status === "disconnected" ||
    integration.status === "revoked" ||
    !isEncryptedSecretRef(integration.secret_reference)
  ) {
    return null;
  }
  return integration;
}

/**
 * Pull this app's Shopify App Pricing subscription into local `subscriptions`,
 * reading `currentAppInstallation.activeSubscriptions` with the shop's own token
 * (Admin API). Shopify is the only paid provider, so it replaces demo or retired
 * Stripe rows. Runs on install, from "Sincronizar estado", on the
 * app_subscriptions/update webhook and from the cron sweep.
 */
export async function syncShopifyAppPricingForAgency(input: {
  agencyId: string;
  shopDomain: string;
  /** Shop GID when the caller already has it; stored as provider_customer_id. */
  shopGid?: string | null;
  admin?: DatabaseClient;
}): Promise<ShopifySubscriptionSyncResult> {
  const admin = input.admin ?? createAdminClient();
  const integration = await loadShopIntegration(admin, input);
  if (!integration) {
    return { kind: "skipped", reason: "shopify_not_connected" };
  }

  const accessToken = await ensureShopifyAccessToken(admin, integration, input.shopDomain);
  const current = pickCurrentAppSubscription(
    await fetchShopifyAppSubscriptions(input.shopDomain, accessToken),
  );

  const existing = await loadAgencySubscription(admin, input.agencyId);
  const shopGid =
    (input.shopGid ? normalizeShopifyShopGid(input.shopGid) : null) ??
    (integration.external_account_id
      ? normalizeShopifyShopGid(integration.external_account_id)
      : null);
  const prevMeta =
    existing?.metadata &&
    typeof existing.metadata === "object" &&
    !Array.isArray(existing.metadata)
      ? (existing.metadata as Record<string, unknown>)
      : {};

  if (!current) {
    if (!existing || existing.billing_provider !== "shopify") {
      return { kind: "unchanged", reason: "no_active_shopify_subscription" };
    }

    const metadata = mergeSubscriptionBillingMetadata({
      previous: prevMeta,
      status: "cancelled",
      sourceEvent: "shopify.currentAppInstallation.none",
      currentPeriodEnd: null,
    });
    metadata.shopify_shop_domain = input.shopDomain;

    const { error } = await admin
      .from("subscriptions")
      .update({
        status: "cancelled" as Enums<"subscription_status">,
        billing_provider: "shopify",
        cancel_at_period_end: false,
        metadata: metadata as Json,
        updated_at: new Date().toISOString(),
      })
      .eq("id", existing.id);
    if (error) throw error;
    return { kind: "cleared", subscriptionId: existing.id };
  }

  const mapped = mapShopifyAppSubscription(current);
  if (!mapped.planCode) {
    return { kind: "skipped", reason: `unknown_plan_name_${current.name || "empty"}` };
  }
  const { data: plan } = await admin
    .from("plans")
    .select("id")
    .eq("code", mapped.planCode)
    .eq("is_active", true)
    .maybeSingle();
  if (!plan?.id) {
    return { kind: "skipped", reason: `unknown_plan_${mapped.planCode}` };
  }

  const metadata = mergeSubscriptionBillingMetadata({
    previous: prevMeta,
    status: mapped.status,
    billingInterval: mapped.billingInterval,
    sourceEvent: "shopify.currentAppInstallation",
    currentPeriodEnd: mapped.currentPeriodEnd,
  });
  if (shopGid) metadata.shopify_shop_gid = shopGid;
  metadata.shopify_shop_domain = input.shopDomain;
  metadata.shopify_plan_name = current.name;

  const row = {
    agency_id: input.agencyId,
    plan_id: plan.id,
    status: mapped.status,
    billing_provider: "shopify",
    provider_customer_id: shopGid ?? input.shopDomain,
    provider_subscription_id: mapped.providerSubscriptionId,
    cancel_at_period_end: mapped.cancelAtPeriodEnd,
    current_period_start: mapped.currentPeriodStart,
    current_period_end: mapped.currentPeriodEnd,
    trial_ends_at: mapped.trialEndsAt,
    metadata: metadata as Json,
    updated_at: new Date().toISOString(),
  };

  if (existing) {
    const { error } = await admin.from("subscriptions").update(row).eq("id", existing.id);
    if (error) throw error;
    return {
      kind: "synced",
      status: mapped.status,
      planCode: mapped.planCode,
      subscriptionId: existing.id,
    };
  }

  const { data: created, error } = await admin
    .from("subscriptions")
    .insert(row)
    .select("id")
    .single();
  if (error || !created) {
    throw error ?? new Error("No se pudo crear la suscripción Shopify.");
  }
  return {
    kind: "synced",
    status: mapped.status,
    planCode: mapped.planCode,
    subscriptionId: created.id,
  };
}

/** Best-effort sync; never throws to callers that must stay available (embed). */
export async function syncShopifyAppPricingForAgencySafe(
  input: Parameters<typeof syncShopifyAppPricingForAgency>[0],
): Promise<ShopifySubscriptionSyncResult> {
  try {
    return await syncShopifyAppPricingForAgency(input);
  } catch (error) {
    logger.warn("shopify.billing.sync_failed", {
      agency_id: input.agencyId,
      shop: input.shopDomain,
      error: error instanceof Error ? error.message : String(error),
    });
    return {
      kind: "skipped",
      reason: error instanceof Error ? error.message.slice(0, 160) : "sync_failed",
    };
  }
}

/** Sync the agency that owns this shop (app_subscriptions/update webhook). */
export async function syncShopifyAppPricingForShop(input: {
  shopDomain: string;
  admin?: DatabaseClient;
}): Promise<ShopifySubscriptionSyncResult> {
  const admin = input.admin ?? createAdminClient();
  const { data: store, error } = await admin
    .from("stores")
    .select("agency_id")
    .eq("shopify_shop_domain", input.shopDomain)
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  if (!store?.agency_id) return { kind: "skipped", reason: "shop_not_linked" };
  return syncShopifyAppPricingForAgencySafe({
    agencyId: store.agency_id,
    shopDomain: input.shopDomain,
    admin,
  });
}

/**
 * Reconcile App Pricing for connected Shopify stores (cron safety net behind the webhook).
 */
export async function sweepShopifyAppPricingSubscriptions(
  admin: DatabaseClient = createAdminClient(),
  options: { limit?: number } = {},
): Promise<ShopifyBillingSweepResult> {
  const limit = options.limit ?? 40;
  const result: ShopifyBillingSweepResult = {
    scanned: 0,
    synced: 0,
    cleared: 0,
    skipped: 0,
    errors: 0,
    results: [],
  };

  const { data: stores, error } = await admin
    .from("stores")
    .select("id, agency_id, shopify_shop_domain")
    .eq("is_active", true)
    .not("shopify_shop_domain", "is", null)
    .order("updated_at", { ascending: true })
    .limit(limit);
  if (error) throw error;

  for (const store of stores ?? []) {
    const shopDomain = store.shopify_shop_domain?.trim();
    if (!shopDomain || !store.agency_id) continue;
    result.scanned += 1;
    try {
      const outcome = await syncShopifyAppPricingForAgency({
        agencyId: store.agency_id,
        shopDomain,
        admin,
      });
      result.results.push({
        agencyId: store.agency_id,
        shopDomain,
        outcome: outcome.kind,
        detail: "reason" in outcome ? outcome.reason : outcome.kind,
      });
      if (outcome.kind === "synced") result.synced += 1;
      else if (outcome.kind === "cleared") result.cleared += 1;
      else result.skipped += 1;
    } catch (err) {
      result.errors += 1;
      result.results.push({
        agencyId: store.agency_id,
        shopDomain,
        outcome: "error",
        detail: err instanceof Error ? err.message.slice(0, 160) : String(err),
      });
    }
  }

  return result;
}
