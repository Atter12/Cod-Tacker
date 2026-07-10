import { TeamManager } from "@/components/agency/TeamManager";
import { SectionHeader } from "@/components/ui";
import { can } from "@/lib/permissions/can";
import { createClient } from "@/lib/supabase/server";
import { requireAgencyAccess } from "@/lib/tenant/require-agency-access";

export default async function AgencyTeamPage({ params }: { params: Promise<{ agencySlug: string }> }) {
  const p = await params;
  const membership = await requireAgencyAccess(p.agencySlug);
  const supabase = await createClient();

  const { data: members } = await supabase
    .from("agency_members")
    .select("id, user_id, role, status, joined_at, created_at")
    .eq("agency_id", membership.agencyId)
    .order("created_at");

  const userIds = (members ?? []).map((member) => member.user_id);
  const { data: profiles } = userIds.length
    ? await supabase.from("profiles").select("id, email, full_name").in("id", userIds)
    : { data: [] };

  const enriched = (members ?? []).map((member) => {
    const profile = (profiles ?? []).find((item) => item.id === member.user_id);
    return {
      ...member,
      email: profile?.email ?? null,
      full_name: profile?.full_name ?? null,
    };
  });

  const { data: invitations } = await supabase
    .from("agency_invitations")
    .select("id, email, role, status, expires_at, created_at")
    .eq("agency_id", membership.agencyId)
    .eq("status", "pending")
    .order("created_at", { ascending: false });

  return (
    <section className="space-y-5">
      <SectionHeader title="Equipo" description="Miembros e invitaciones de esta agencia." />
      <TeamManager
        agencySlug={p.agencySlug}
        members={enriched}
        invitations={invitations ?? []}
        canInvite={can(membership.roles, "agency.team.invite")}
        canManage={can(membership.roles, "agency.team.manage")}
      />
    </section>
  );
}
