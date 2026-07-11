import Link from "next/link";
import { DataTable, ErrorState, SectionHeader } from "@/components/ui";
import { routes } from "@/config/routes";
import { can } from "@/lib/permissions/can";
import { createClient } from "@/lib/supabase/server";
import { requireStoreAccess } from "@/lib/tenant/require-store-access";
import { getAdSetById, listAds } from "@/services/attribution.service";

export default async function AdSetDetailPage({
  params,
}: {
  params: Promise<{
    agencySlug: string;
    storeSlug: string;
    campaignId: string;
    adSetId: string;
  }>;
}) {
  const p = await params;
  const member = await requireStoreAccess(p.agencySlug, p.storeSlug);
  if (!can(member.roles, "attribution.view") || !member.storeId) {
    return <ErrorState title="Sin permiso" description="No puedes ver este ad set." />;
  }
  const client = await createClient();
  const adSet = await getAdSetById(client, member.storeId, p.adSetId);
  if (!adSet) {
    return <ErrorState title="No encontrado" description="Ad set inexistente." />;
  }
  const ads = await listAds(client, member.storeId, adSet.id);

  return (
    <section className="space-y-5">
      <SectionHeader
        title={adSet.name}
        description="Ads del conjunto"
        action={
          <Link
            className="text-sm underline text-brand-primary"
            href={routes.store.campaignDetail(p.agencySlug, p.storeSlug, p.campaignId)}
          >
            Volver a campaña
          </Link>
        }
      />
      <DataTable
        data={ads}
        getRowId={(row) => row.id}
        columns={[
          {
            id: "name",
            header: "Anuncio",
            cell: (row) => (
              <Link
                className="underline text-brand-primary"
                href={routes.store.adDetail(p.agencySlug, p.storeSlug, row.id)}
              >
                {row.name}
              </Link>
            ),
          },
          { id: "status", header: "Estado", cell: (row) => row.status ?? "—" },
          { id: "ext", header: "External ID", cell: (row) => row.external_ad_id },
        ]}
        emptyMessage="Sin anuncios."
      />
    </section>
  );
}
