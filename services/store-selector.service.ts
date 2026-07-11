import "server-only";

import { createClient } from "@/lib/supabase/server";
import { getUser } from "@/lib/auth/get-session";
import { getAccessibleStores, type AccessibleStore } from "@/lib/tenant/get-accessible-stores";
import { getActiveTenantPreference } from "@/lib/tenant/active-tenant-cookie";
import { getAgencyPlanLimits, STARTER_DEFAULT_STORE_LIMIT } from "@/lib/billing/limits";
import { can } from "@/lib/permissions/can";
import type { Role } from "@/config/permissions";
import { routes } from "@/config/routes";

export type StoreHealth = "healthy" | "available" | "review";

export type StoreSelectorCard = {
  storeId: string;
  agencyId: string;
  agencySlug: string;
  agencyName: string;
  storeSlug: string;
  name: string;
  description: string;
  effectiveRole: AccessibleStore["effectiveRole"];
  health: StoreHealth;
  isLastUsed: boolean;
  currencyCode: string;
};

export type AccountSelectorSummary = {
  stores: number;
  activeIntegrations: number;
  ordersLast30Days: number;
  collectedLast30Days: number | null;
  currencyCode: string | null;
  hasMixedCurrencies: boolean;
};

export type RecentAccountEvent = {
  id: string;
  tone: "success" | "warning" | "danger" | "info";
  text: string;
  at: string;
};

export type CreateStoreEligibility = {
  visible: boolean;
  enabled: boolean;
  agencySlug: string | null;
  billingHref: string | null;
  reason: "ok" | "at_limit" | "no_permission" | null;
};

export type StoreSelectorPageData = {
  user: {
    id: string;
    fullName: string | null;
    email: string | null;
    avatarUrl: string | null;
  };
  stores: StoreSelectorCard[];
  summary: AccountSelectorSummary | null;
  summaryError: string | null;
  activity: RecentAccountEvent[];
  createStore: CreateStoreEligibility;
};

function storeDescription(agencyName: string, settings: unknown): string {
  if (settings && typeof settings === "object" && !Array.isArray(settings)) {
    const tagline = (settings as Record<string, unknown>).tagline;
    if (typeof tagline === "string" && tagline.trim()) return tagline.trim();
  }
  return agencyName ? `Operación ecommerce COD · ${agencyName}` : "Operación ecommerce COD";
}

export async function getStoreSelectorPageData(): Promise<StoreSelectorPageData> {
  const user = await getUser();
  if (!user) {
    return {
      user: { id: "", fullName: null, email: null, avatarUrl: null },
      stores: [],
      summary: null,
      summaryError: null,
      activity: [],
      createStore: { visible: false, enabled: false, agencySlug: null, billingHref: null, reason: "no_permission" },
    };
  }

  const client = await createClient();
  const [stores, preferred, profileResult] = await Promise.all([
    getAccessibleStores(user.id),
    getActiveTenantPreference(),
    client.from("profiles").select("full_name, email, avatar_url").eq("id", user.id).maybeSingle(),
  ]);

  const storeIds = stores.map((s) => s.storeId);
  const currencyByStore = new Map<string, string>();
  const settingsByStore = new Map<string, unknown>();

  if (storeIds.length) {
    const { data: storeRows } = await client
      .from("stores")
      .select("id, currency_code, settings")
      .in("id", storeIds);
    for (const row of storeRows ?? []) {
      currencyByStore.set(row.id, row.currency_code);
      settingsByStore.set(row.id, row.settings);
    }
  }

  const healthByStore = await loadStoreHealth(storeIds);

  const cards: StoreSelectorCard[] = stores.map((store) => ({
    storeId: store.storeId,
    agencyId: store.agencyId,
    agencySlug: store.agencySlug,
    agencyName: store.agencyName,
    storeSlug: store.storeSlug,
    name: store.storeName,
    description: storeDescription(store.agencyName, settingsByStore.get(store.storeId)),
    effectiveRole: store.effectiveRole,
    health: healthByStore.get(store.storeId) ?? "available",
    isLastUsed:
      preferred.agencySlug === store.agencySlug && preferred.storeSlug === store.storeSlug,
    currencyCode: currencyByStore.get(store.storeId) ?? "PEN",
  }));

  let summary: AccountSelectorSummary | null = null;
  let summaryError: string | null = null;
  try {
    summary = await loadAccountSummary(storeIds, cards);
  } catch {
    summaryError = "No se pudo cargar el resumen de cuenta.";
  }

  const [activity, createStore] = await Promise.all([
    loadRecentActivity(storeIds, cards),
    loadCreateStoreEligibility(user.id, stores),
  ]);

  return {
    user: {
      id: user.id,
      fullName: profileResult.data?.full_name ?? null,
      email: profileResult.data?.email ?? user.email ?? null,
      avatarUrl: profileResult.data?.avatar_url ?? null,
    },
    stores: cards,
    summary,
    summaryError,
    activity,
    createStore,
  };
}

async function loadStoreHealth(storeIds: string[]): Promise<Map<string, StoreHealth>> {
  const map = new Map<string, StoreHealth>();
  if (!storeIds.length) return map;

  const client = await createClient();
  const since = new Date(Date.now() - 7 * 86400000).toISOString();

  const [{ data: alerts }, { data: syncs }, { data: health }] = await Promise.all([
    client
      .from("alerts")
      .select("store_id")
      .in("store_id", storeIds)
      .eq("severity", "critical")
      .in("status", ["open", "reopened", "acknowledged"])
      .limit(200),
    client
      .from("sync_runs")
      .select("store_id, status")
      .in("store_id", storeIds)
      .gte("created_at", since)
      .eq("status", "failed")
      .limit(200),
    client
      .from("integration_health_checks")
      .select("store_id, status, checked_at")
      .in("store_id", storeIds)
      .order("checked_at", { ascending: false })
      .limit(100),
  ]);

  const review = new Set<string>();
  for (const row of alerts ?? []) {
    if (row.store_id) review.add(row.store_id);
  }
  for (const row of syncs ?? []) {
    review.add(row.store_id);
  }

  const latestHealth = new Map<string, string>();
  for (const row of health ?? []) {
    if (!latestHealth.has(row.store_id)) latestHealth.set(row.store_id, row.status);
  }
  for (const [storeId, status] of latestHealth) {
    if (status === "down" || status === "degraded") review.add(storeId);
  }

  const { data: integrations } = await client
    .from("integrations")
    .select("store_id, status")
    .in("store_id", storeIds)
    .in("status", ["connected", "degraded"]);

  const hasIntegration = new Set((integrations ?? []).map((i) => i.store_id).filter(Boolean) as string[]);

  for (const id of storeIds) {
    if (review.has(id)) map.set(id, "review");
    else if (hasIntegration.has(id)) map.set(id, "healthy");
    else map.set(id, "available");
  }
  return map;
}

async function loadAccountSummary(
  storeIds: string[],
  cards: StoreSelectorCard[],
): Promise<AccountSelectorSummary> {
  const client = await createClient();
  const currencies = [...new Set(cards.map((c) => c.currencyCode))];
  const hasMixedCurrencies = currencies.length > 1;
  const currencyCode = currencies.length === 1 ? (currencies[0] ?? null) : null;

  if (!storeIds.length) {
    return {
      stores: 0,
      activeIntegrations: 0,
      ordersLast30Days: 0,
      collectedLast30Days: 0,
      currencyCode,
      hasMixedCurrencies: false,
    };
  }

  const since = new Date(Date.now() - 30 * 86400000).toISOString();

  const [{ count: integrationCount }, { count: orderCount }, orderAmountQuery] = await Promise.all([
    client
      .from("integrations")
      .select("*", { count: "exact", head: true })
      .in("store_id", storeIds)
      .in("status", ["connected", "degraded"]),
    client
      .from("orders")
      .select("*", { count: "exact", head: true })
      .in("store_id", storeIds)
      .gte("created_at", since),
    hasMixedCurrencies
      ? Promise.resolve({ data: null as { collected_cod_amount: number | null }[] | null })
      : client
          .from("orders")
          .select("collected_cod_amount")
          .in("store_id", storeIds)
          .gte("created_at", since)
          .not("collected_cod_amount", "is", null)
          .limit(10000),
  ]);

  let collected: number | null = 0;
  if (hasMixedCurrencies) {
    collected = null;
  } else {
    for (const row of orderAmountQuery.data ?? []) {
      collected = (collected ?? 0) + Number(row.collected_cod_amount ?? 0);
    }
  }

  return {
    stores: cards.length,
    activeIntegrations: integrationCount ?? 0,
    ordersLast30Days: orderCount ?? 0,
    collectedLast30Days: collected,
    currencyCode,
    hasMixedCurrencies,
  };
}

async function loadRecentActivity(
  storeIds: string[],
  cards: StoreSelectorCard[],
): Promise<RecentAccountEvent[]> {
  if (!storeIds.length) return [];
  const client = await createClient();
  const nameById = new Map(cards.map((c) => [c.storeId, c.name]));
  const events: RecentAccountEvent[] = [];

  const [{ data: syncs }, { data: alerts }, { data: health }] = await Promise.all([
    client
      .from("sync_runs")
      .select("id, store_id, status, finished_at, created_at")
      .in("store_id", storeIds)
      .order("created_at", { ascending: false })
      .limit(5),
    client
      .from("alerts")
      .select("id, store_id, title, severity, status, created_at")
      .in("store_id", storeIds)
      .in("status", ["open", "reopened", "acknowledged"])
      .order("created_at", { ascending: false })
      .limit(5),
    client
      .from("integration_health_checks")
      .select("id, store_id, status, checked_at")
      .in("store_id", storeIds)
      .in("status", ["degraded", "down"])
      .order("checked_at", { ascending: false })
      .limit(5),
  ]);

  for (const row of syncs ?? []) {
    const name = nameById.get(row.store_id) ?? "Tienda";
    const ok = row.status === "completed" || row.status === "partial";
    events.push({
      id: `sync-${row.id}`,
      tone: ok ? "success" : "danger",
      text: ok
        ? `${name} completó una sincronización.`
        : `${name} tuvo un sync fallido.`,
      at: row.finished_at ?? row.created_at,
    });
  }

  for (const row of alerts ?? []) {
    const name = row.store_id ? nameById.get(row.store_id) ?? "Tienda" : "Cuenta";
    events.push({
      id: `alert-${row.id}`,
      tone: row.severity === "critical" ? "danger" : "warning",
      text: `${name}: ${row.title}`,
      at: row.created_at,
    });
  }

  for (const row of health ?? []) {
    const name = nameById.get(row.store_id) ?? "Tienda";
    events.push({
      id: `health-${row.id}`,
      tone: row.status === "down" ? "danger" : "warning",
      text: `${name} tiene una integración que requiere revisión.`,
      at: row.checked_at,
    });
  }

  return events
    .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
    .slice(0, 3);
}

async function loadCreateStoreEligibility(
  userId: string,
  stores: AccessibleStore[],
): Promise<CreateStoreEligibility> {
  const client = await createClient();
  const { data: members } = await client
    .from("agency_members")
    .select("agency_id, role")
    .eq("user_id", userId)
    .eq("status", "active")
    .in("role", ["owner", "admin"]);

  const eligible = (members ?? []).filter((m) => can([m.role as Role], "store.create"));
  if (!eligible.length) {
    return { visible: false, enabled: false, agencySlug: null, billingHref: null, reason: "no_permission" };
  }

  const agencyIds = eligible.map((m) => m.agency_id);
  const { data: agencies } = await client
    .from("agencies")
    .select("id, slug")
    .in("id", agencyIds)
    .eq("is_active", true);

  const agency = agencies?.[0];
  if (!agency) {
    return { visible: false, enabled: false, agencySlug: null, billingHref: null, reason: "no_permission" };
  }

  const limits = await getAgencyPlanLimits(client, agency.id);
  const storeCount = stores.filter((s) => s.agencyId === agency.id).length;
  // Prefer accurate count from DB for the agency
  const { count } = await client
    .from("stores")
    .select("*", { count: "exact", head: true })
    .eq("agency_id", agency.id)
    .eq("is_active", true);
  const used = count ?? storeCount;
  const storeLimit = limits?.storeLimit ?? STARTER_DEFAULT_STORE_LIMIT;
  const atLimit = storeLimit !== null && used >= storeLimit;

  return {
    visible: true,
    enabled: !atLimit,
    agencySlug: agency.slug,
    billingHref: atLimit ? routes.agency.billing(agency.slug) : null,
    reason: atLimit ? "at_limit" : "ok",
  };
}
