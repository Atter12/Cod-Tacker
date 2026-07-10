import { throwQueryError, type DatabaseClient } from "./_shared";

export type PlatformOverviewCounts = { agencies: number; stores: number; users: number; integrations: number; carriers: number };

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
  return { agencies: agencies.count ?? 0, stores: stores.count ?? 0, users: users.count ?? 0, integrations: integrations.count ?? 0, carriers: carriers.count ?? 0 };
}

/** Lists are deliberately executed with the authenticated request client so RLS
 * remains the source of truth for platform-admin visibility. */
export async function getPlatformRecords(client: DatabaseClient) {
  const [agencies, stores, users, integrations, carriers] = await Promise.all([
    client.from("agencies").select("id, name, slug, created_at, created_by").order("created_at", { ascending: false }).limit(100),
    client.from("stores").select("id, agency_id, name, slug, created_at").order("created_at", { ascending: false }).limit(100),
    client.from("profiles").select("id, email, full_name, platform_role, created_at").order("created_at", { ascending: false }).limit(100),
    client.from("integrations").select("id, agency_id, store_id, provider, status, display_name, connected_at, created_at").order("created_at", { ascending: false }).limit(100),
    client.from("carriers").select("id, name, code, is_active, created_at").order("created_at", { ascending: false }).limit(100),
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
