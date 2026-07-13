import { AgencyOverview } from "@/components/agency/AgencyOverview";
import { getProfile } from "@/lib/auth/get-profile";
import {
  STARTER_DEFAULT_ORDER_LIMIT,
  STARTER_DEFAULT_STORE_LIMIT,
} from "@/lib/billing/limits";
import { can } from "@/lib/permissions/can";
import { createClient } from "@/lib/supabase/server";
import { requireAgencyAccess } from "@/lib/tenant/require-agency-access";
import { getBillingOverview } from "@/services/billing.service";

export default async function AgencyOverviewPage({
  params,
}: {
  params: Promise<{ agencySlug: string }>;
}) {
  const p = await params;
  const [membership, profile, client] = await Promise.all([
    requireAgencyAccess(p.agencySlug),
    getProfile(),
    createClient(),
  ]);

  const [overview, storesRes, membersRes, invitationsRes, agencyRes] = await Promise.all([
    getBillingOverview(client, membership.agencyId),
    client
      .from("stores")
      .select("id, name, is_active, created_at")
      .eq("agency_id", membership.agencyId)
      .order("created_at", { ascending: false })
      .limit(5),
    client
      .from("agency_members")
      .select("id", { count: "exact", head: true })
      .eq("agency_id", membership.agencyId)
      .eq("status", "active"),
    client
      .from("agency_invitations")
      .select("id, email, created_at")
      .eq("agency_id", membership.agencyId)
      .eq("status", "pending")
      .order("created_at", { ascending: false })
      .limit(3),
    client.from("agencies").select("name, slug").eq("id", membership.agencyId).maybeSingle(),
  ]);

  const storeLimit = overview.limits?.storeLimit ?? STARTER_DEFAULT_STORE_LIMIT;
  const orderLimit = overview.limits?.orderLimit ?? STARTER_DEFAULT_ORDER_LIMIT;
  const planName = overview.limits?.planName ?? "Starter";
  const planActive =
    !overview.limits?.subscriptionStatus ||
    ["active", "trialing"].includes(overview.limits.subscriptionStatus);

  const activity = [
    ...(storesRes.data ?? []).slice(0, 2).map((store) => ({
      id: `store-${store.id}`,
      title: store.is_active ? "Tienda activa" : "Tienda registrada",
      detail: `${store.name} · ${new Date(store.created_at).toLocaleDateString("es")}`,
      tone: "brand" as const,
    })),
    ...(invitationsRes.data ?? []).slice(0, 2).map((inv) => ({
      id: `inv-${inv.id}`,
      title: "Invitación pendiente",
      detail: `${inv.email} · ${new Date(inv.created_at).toLocaleDateString("es")}`,
      tone: "info" as const,
    })),
  ].slice(0, 4);

  const userName =
    profile?.full_name?.split(" ")[0] ??
    profile?.email?.split("@")[0] ??
    "equipo";

  return (
    <AgencyOverview
      agencySlug={p.agencySlug}
      agencyName={agencyRes.data?.name ?? p.agencySlug}
      userName={userName}
      storeCount={overview.storeCount}
      storeLimit={storeLimit}
      orderCount={overview.orderCountThisMonth}
      orderLimit={orderLimit}
      memberCount={membersRes.count ?? 0}
      planName={planName}
      planActive={planActive}
      canCreateStore={can(membership.roles, "store.create")}
      canInvite={can(membership.roles, "agency.team.invite")}
      canManageBrand={can(membership.roles, "branding.manage")}
      canViewBilling={can(membership.roles, "billing.view")}
      activity={activity}
    />
  );
}
