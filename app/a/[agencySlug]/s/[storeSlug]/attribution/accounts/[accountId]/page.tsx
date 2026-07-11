import Link from "next/link";
import { DataTable, ErrorState, SectionHeader } from "@/components/ui";
import { routes } from "@/config/routes";
import { can } from "@/lib/permissions/can";
import { createClient } from "@/lib/supabase/server";
import { requireStoreAccess } from "@/lib/tenant/require-store-access";
import {
  getAdAccountById,
  listCampaignsForAccount,
} from "@/services/attribution.service";

export default async function AttributionAccountPage({
  params,
}: {
  params: Promise<{ agencySlug: string; storeSlug: string; accountId: string }>;
}) {
  const p = await params;
  const member = await requireStoreAccess(p.agencySlug, p.storeSlug);
  if (!can(member.roles, "attribution.view") || !member.storeId) {
    return <ErrorState title="Sin permiso" description="No puedes ver esta cuenta." />;
  }
  const client = await createClient();
  const account = await getAdAccountById(client, member.storeId, p.accountId);
  if (!account) {
    return <ErrorState title="No encontrada" description="Cuenta publicitaria inexistente." />;
  }
  const campaigns = await listCampaignsForAccount(client, member.storeId, account.id);

  return (
    <section className="space-y-5">
      <SectionHeader
        title={account.name ?? account.external_account_id}
        description={`Plataforma ${account.platform}`}
        action={
          <Link
            className="text-sm underline text-brand-primary"
            href={routes.store.attribution(p.agencySlug, p.storeSlug)}
          >
            Volver
          </Link>
        }
      />
      <DataTable
        data={campaigns}
        getRowId={(row) => row.id}
        columns={[
          {
            id: "name",
            header: "Campaña",
            cell: (row) => (
              <Link
                className="underline text-brand-primary"
                href={routes.store.campaignDetail(p.agencySlug, p.storeSlug, row.id)}
              >
                {row.name}
              </Link>
            ),
          },
          { id: "status", header: "Estado", cell: (row) => row.status ?? "—" },
          { id: "objective", header: "Objetivo", cell: (row) => row.objective ?? "—" },
        ]}
        emptyMessage="Sin campañas en esta cuenta."
      />
    </section>
  );
}
