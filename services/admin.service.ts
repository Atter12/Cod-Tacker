import { throwQueryError, type DatabaseClient } from "./_shared";

export type PlatformOverviewCounts = {
  agencies: number;
  stores: number;
  users: number;
  integrations: number;
  carriers: number;
};

/** Uses the caller's request client. Platform-admin RLS policies must grant these counts; this UI path never uses a service role. */
export async function getPlatformOverviewCounts(client: DatabaseClient): Promise<PlatformOverviewCounts> {
  const [agencies, stores, users, integrations, carriers] = await Promise.all([
    client.from("agencies").select("*", { count: "exact", head: true }),
    client.from("stores").select("*", { count: "exact", head: true }),
    client.from("profiles").select("*", { count: "exact", head: true }),
    client.from("integrations").select("*", { count: "exact", head: true }),
    client.from("carriers").select("*", { count: "exact", head: true }),
  ]);
  for (const result of [agencies, stores, users, integrations, carriers]) throwQueryError(result.error);
  return {
    agencies: agencies.count ?? 0,
    stores: stores.count ?? 0,
    users: users.count ?? 0,
    integrations: integrations.count ?? 0,
    carriers: carriers.count ?? 0,
  };
}

/** Lists are deliberately executed with the authenticated request client so RLS
 * remains the source of truth for platform-admin visibility. */
export async function getPlatformRecords(client: DatabaseClient) {
  const [agencies, stores, users, integrations, carriers] = await Promise.all([
    client
      .from("agencies")
      .select("id, name, slug, is_active, is_white_label_enabled, created_at, created_by")
      .order("created_at", { ascending: false })
      .limit(100),
    client
      .from("stores")
      .select("id, agency_id, name, slug, is_active, created_at")
      .order("created_at", { ascending: false })
      .limit(100),
    client
      .from("profiles")
      .select("id, email, full_name, platform_role, is_active, created_at")
      .order("created_at", { ascending: false })
      .limit(100),
    client
      .from("integrations")
      .select("id, agency_id, store_id, provider, status, display_name, connected_at, created_at")
      .order("created_at", { ascending: false })
      .limit(100),
    client
      .from("carriers")
      .select("id, name, code, is_active, created_at")
      .order("created_at", { ascending: false })
      .limit(100),
  ]);
  for (const result of [agencies, stores, users, integrations, carriers]) throwQueryError(result.error);
  return {
    agencies: agencies.data ?? [],
    stores: stores.data ?? [],
    users: users.data ?? [],
    integrations: integrations.data ?? [],
    carriers: carriers.data ?? [],
  };
}

export async function getPlatformAgencyDetail(client: DatabaseClient, agencyId: string) {
  const { data: agency, error } = await client.from("agencies").select("*").eq("id", agencyId).maybeSingle();
  throwQueryError(error);
  if (!agency) return null;

  const [stores, members, subscription, integrations] = await Promise.all([
    client.from("stores").select("id, name, slug, is_active, created_at").eq("agency_id", agencyId).order("name"),
    client
      .from("agency_members")
      .select("id, user_id, role, status, joined_at")
      .eq("agency_id", agencyId)
      .order("created_at", { ascending: false })
      .limit(50),
    client
      .from("subscriptions")
      .select("id, status, plan_id, cancel_at_period_end, trial_ends_at, current_period_end")
      .eq("agency_id", agencyId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    client
      .from("integrations")
      .select("id, provider, status, store_id, display_name")
      .eq("agency_id", agencyId)
      .limit(50),
  ]);

  let plan: { code: string; name: string; store_limit: number | null; order_limit: number | null } | null =
    null;
  if (subscription.data?.plan_id) {
    const { data: planRow } = await client
      .from("plans")
      .select("code, name, store_limit, order_limit")
      .eq("id", subscription.data.plan_id)
      .maybeSingle();
    plan = planRow;
  }

  return {
    agency,
    stores: stores.data ?? [],
    members: members.data ?? [],
    subscription: subscription.data
      ? { ...subscription.data, plans: plan }
      : null,
    integrations: integrations.data ?? [],
  };
}

export async function getPlatformStoreDetail(client: DatabaseClient, storeId: string) {
  const { data: store, error } = await client.from("stores").select("*").eq("id", storeId).maybeSingle();
  throwQueryError(error);
  if (!store) return null;

  const [agency, integrations, orderCount] = await Promise.all([
    client.from("agencies").select("id, name, slug, is_active").eq("id", store.agency_id).maybeSingle(),
    client
      .from("integrations")
      .select("id, provider, status, display_name")
      .eq("store_id", storeId)
      .limit(50),
    client.from("orders").select("*", { count: "exact", head: true }).eq("store_id", storeId),
  ]);

  return {
    store,
    agency: agency.data,
    integrations: integrations.data ?? [],
    orderCount: orderCount.count ?? 0,
  };
}

export async function getPlatformUserDetail(client: DatabaseClient, userId: string) {
  const { data: profile, error } = await client.from("profiles").select("*").eq("id", userId).maybeSingle();
  throwQueryError(error);
  if (!profile) return null;

  const [agencyMemberships, storeMemberships] = await Promise.all([
    client
      .from("agency_members")
      .select("id, agency_id, role, status, agencies(name, slug)")
      .eq("user_id", userId)
      .limit(50),
    client
      .from("store_members")
      .select("id, store_id, role, status, stores(name, slug)")
      .eq("user_id", userId)
      .limit(50),
  ]);

  return {
    profile,
    agencyMemberships: agencyMemberships.data ?? [],
    storeMemberships: storeMemberships.data ?? [],
  };
}

/** Audit logs are optional in early deployments; unavailable RLS/table access
 * intentionally renders an empty admin state instead of exposing an error. */
export async function getPlatformAuditLogs(client: DatabaseClient) {
  const { data, error } = await client
    .from("audit_logs")
    .select("id, action, entity_type, entity_id, actor_id, created_at")
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) return [];
  return data ?? [];
}
