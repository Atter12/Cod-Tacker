import "server-only";

import { mergeSubscriptionBillingMetadata } from "@/lib/billing/subscription-metadata";
import { normalizeShopifyShopGid } from "@/lib/billing/shopify-gids";
import {
  getShopifyPartnerEnv,
  isShopifyPartnerApiConfigured,
} from "@/lib/billing/shopify-partner-env";
import { mapShopifyActiveSubscription } from "@/lib/billing/shopify-subscription-map";
import { fetchShopifyShopInfo } from "@/lib/integrations/shopify/admin-api";
import { ensureShopifyAccessToken } from "@/lib/integrations/shopify/credentials";
import { fetchShopifyActiveSubscription } from "@/lib/integrations/shopify/partner-api";
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

async function resolveShopGid(
  admin: DatabaseClient,
  input: { agencyId: string; shopDomain: string; shopGid?: string | null },
): Promise<string | null> {
  const hinted = input.shopGid ? normalizeShopifyShopGid(input.shopGid) : null;
  if (hinted) return hinted;

  const { data: integration } = await admin
    .from("integrations")
    .select("id, agency_id, store_id, external_account_id, secret_reference, settings, metadata")
    .eq("agency_id", input.agencyId)
    .eq("provider", "shopify")
    .eq("status", "connected")
    .order("connected_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const fromRow = integration?.external_account_id
    ? normalizeShopifyShopGid(integration.external_account_id)
    : null;
  if (fromRow) return fromRow;

  if (!integration?.secret_reference) return null;

  try {
    const accessToken = await ensureShopifyAccessToken(admin, integration, input.shopDomain);
    const shopInfo = await fetchShopifyShopInfo(input.shopDomain, accessToken);
    const gid = normalizeShopifyShopGid(shopInfo.id);
    if (gid) {
      await admin
        .from("integrations")
        .update({
          external_account_id: shopInfo.id,
          updated_at: new Date().toISOString(),
        })
        .eq("id", integration.id);
    }
    return gid;
  } catch {
    return null;
  }
}

/**
 * Pull Shopify App Pricing state into local `subscriptions`.
 * Never overwrites a Stripe (or other non-shopify) paid subscription.
 */
export async function syncShopifyAppPricingForAgency(input: {
  agencyId: string;
  shopDomain: string;
  shopGid?: string | null;
  admin?: DatabaseClient;
}): Promise<ShopifySubscriptionSyncResult> {
  if (!isShopifyPartnerApiConfigured()) {
    return { kind: "skipped", reason: "partner_api_not_configured" };
  }

  const admin = input.admin ?? createAdminClient();
  const existing = await loadAgencySubscription(admin, input.agencyId);
  if (
    existing?.billing_provider &&
    existing.billing_provider !== "shopify" &&
    existing.billing_provider !== "demo"
  ) {
    return {
      kind: "skipped",
      reason: `agency_uses_${existing.billing_provider}`,
    };
  }

  const shopGid = await resolveShopGid(admin, input);
  if (!shopGid) {
    return { kind: "skipped", reason: "missing_shop_gid" };
  }

  const partner = getShopifyPartnerEnv()!;
  const remote = await fetchShopifyActiveSubscription({
    appGid: partner.appGid,
    shopGid,
    env: partner,
  });

  const prevMeta =
    existing?.metadata &&
    typeof existing.metadata === "object" &&
    !Array.isArray(existing.metadata)
      ? (existing.metadata as Record<string, unknown>)
      : {};

  if (!remote) {
    if (!existing || existing.billing_provider !== "shopify") {
      return { kind: "unchanged", reason: "no_active_shopify_subscription" };
    }

    const metadata = mergeSubscriptionBillingMetadata({
      previous: prevMeta,
      status: "cancelled",
      sourceEvent: "shopify.activeSubscription.null",
      currentPeriodEnd: null,
    });
    metadata.shopify_shop_gid = shopGid;
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

  const mapped = mapShopifyActiveSubscription(remote, { shopGid });
  let planId = existing?.plan_id ?? null;
  if (mapped.planCode) {
    const { data: plan } = await admin
      .from("plans")
      .select("id")
      .eq("code", mapped.planCode)
      .eq("is_active", true)
      .maybeSingle();
    if (!plan?.id) {
      return { kind: "skipped", reason: `unknown_plan_${mapped.planCode}` };
    }
    planId = plan.id;
  }
  if (!planId) {
    return { kind: "skipped", reason: "missing_plan_id" };
  }

  const metadata = mergeSubscriptionBillingMetadata({
    previous: prevMeta,
    status: mapped.status,
    billingInterval: mapped.billingInterval,
    sourceEvent: "shopify.activeSubscription",
    currentPeriodEnd: mapped.currentPeriodEnd,
  });
  metadata.shopify_shop_gid = shopGid;
  metadata.shopify_shop_domain = input.shopDomain;
  metadata.shopify_plan_handle = pickHandle(remote);

  const row = {
    agency_id: input.agencyId,
    plan_id: planId,
    status: mapped.status,
    billing_provider: "shopify",
    provider_customer_id: shopGid,
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

function pickHandle(remote: {
  items: Array<{ handle: string | null }>;
  pendingUpdate: { items: Array<{ handle: string | null }> } | null;
}): string | null {
  return (
    remote.items.find((i) => i.handle)?.handle ??
    remote.pendingUpdate?.items.find((i) => i.handle)?.handle ??
    null
  );
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

/**
 * Reconcile App Pricing for connected Shopify stores (cron).
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

  if (!isShopifyPartnerApiConfigured()) {
    return result;
  }

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
