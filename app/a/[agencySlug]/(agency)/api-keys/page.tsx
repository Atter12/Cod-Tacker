import { SectionHeader } from "@/components/ui";
import { ApiKeysManager } from "@/components/api-keys/ApiKeysManager";
import { can } from "@/lib/permissions/can";
import { createClient } from "@/lib/supabase/server";
import { requireAgencyAccess } from "@/lib/tenant/require-agency-access";
import { listApiKeys } from "@/services/api-keys.service";

export default async function AgencyApiKeysPage({
  params,
}: {
  params: Promise<{ agencySlug: string }>;
}) {
  const p = await params;
  const membership = await requireAgencyAccess(p.agencySlug);
  const keys = await listApiKeys(await createClient(), membership.agencyId);
  const canManage = can(membership.roles, "api_keys.manage");

  return (
    <section className="space-y-5">
      <SectionHeader
        title="Claves API"
        description="Crea y administra claves de acceso programático para integraciones."
      />
      <ApiKeysManager agencySlug={p.agencySlug} canManage={canManage} keys={keys} />
    </section>
  );
}
