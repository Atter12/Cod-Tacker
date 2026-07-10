import { DataTable, SectionHeader } from "@/components/ui";
import { createClient } from "@/lib/supabase/server";
import { requireStoreAccess } from "@/lib/tenant/require-store-access";
import { listCampaigns } from "@/services/campaigns.service";

export default async function CampaignsPage({ params }: { params: Promise<{ agencySlug: string; storeSlug: string }> }) {
  const p = await params;
  const member = await requireStoreAccess(p.agencySlug, p.storeSlug);
  const to = new Date();
  const from = new Date(to);
  from.setDate(to.getDate() - 30);
  const rows = await listCampaigns(await createClient(), member.storeId!, { from: from.toISOString().slice(0, 10), to: to.toISOString().slice(0, 10) });
  return (
    <section className="space-y-5">
      <SectionHeader title="Campañas" description="Rendimiento publicitario de los últimos 30 días." />
      <DataTable
        data={rows}
        getRowId={(row) => row.campaign.id}
        columns={[
          { id: "nombre", header: "Campaña", cell: (row) => row.campaign.name },
          { id: "gasto", header: "Gasto", cell: (row) => row.spend.toFixed(2) },
          { id: "impresiones", header: "Impresiones", cell: (row) => String(row.impressions) },
          { id: "clicks", header: "Clicks", cell: (row) => String(row.clicks) },
          { id: "conversiones", header: "Conversiones", cell: (row) => String(row.platformConversions) },
        ]}
        emptyMessage="No hay campañas para mostrar."
      />
    </section>
  );
}
