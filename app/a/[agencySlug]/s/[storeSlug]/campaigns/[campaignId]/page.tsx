import Link from "next/link";
import { DataTable, ErrorState, MetricCard, SectionHeader } from "@/components/ui";
import { routes } from "@/config/routes";
import { formatRoas } from "@/lib/attribution/metrics";
import { can } from "@/lib/permissions/can";
import { createClient } from "@/lib/supabase/server";
import { requireStoreAccess } from "@/lib/tenant/require-store-access";
import {
  getCampaignById,
  listAdSets,
  listPrimaryAttributionsForCampaign,
} from "@/services/attribution.service";
import { listCampaigns } from "@/services/campaigns.service";

export default async function CampaignDetailPage({
  params,
}: {
  params: Promise<{ agencySlug: string; storeSlug: string; campaignId: string }>;
}) {
  const p = await params;
  const member = await requireStoreAccess(p.agencySlug, p.storeSlug);
  if (!can(member.roles, "attribution.view") || !member.storeId) {
    return <ErrorState title="Sin permiso" description="No puedes ver esta campaña." />;
  }
  const client = await createClient();
  const campaign = await getCampaignById(client, member.storeId, p.campaignId);
  if (!campaign) {
    return <ErrorState title="No encontrada" description="Campaña inexistente." />;
  }

  const to = new Date().toISOString().slice(0, 10);
  const fromDate = new Date();
  fromDate.setDate(fromDate.getDate() - 30);
  const from = fromDate.toISOString().slice(0, 10);

  const [perfList, adSets, attributions] = await Promise.all([
    listCampaigns(client, member.storeId, { from, to }),
    listAdSets(client, member.storeId, campaign.id),
    listPrimaryAttributionsForCampaign(client, member.storeId, campaign.id),
  ]);
  const perf = perfList.find((r) => r.campaign.id === campaign.id);

  return (
    <section className="space-y-5">
      <SectionHeader
        title={campaign.name}
        description={`Modelo primary attribution · confidence promedio ${perf?.avgConfidence?.toFixed(2) ?? "—"}`}
        action={
          <Link
            className="text-sm underline text-brand-primary"
            href={routes.store.campaigns(p.agencySlug, p.storeSlug)}
          >
            Volver
          </Link>
        }
      />
      {perf && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <MetricCard label="Spend" value={perf.spend.toFixed(2)} />
          <MetricCard label="ROAS gen." value={formatRoas(perf.roasGenerated)} />
          <MetricCard label="ROAS ent." value={formatRoas(perf.roasDelivered)} />
          <MetricCard label="ROAS conc." value={formatRoas(perf.roasSettled)} />
        </div>
      )}
      <h3 className="text-sm font-semibold">Ad sets</h3>
      <DataTable
        data={adSets}
        getRowId={(row) => row.id}
        columns={[
          {
            id: "name",
            header: "Ad set",
            cell: (row) => (
              <Link
                className="underline text-brand-primary"
                href={routes.store.adSetDetail(p.agencySlug, p.storeSlug, campaign.id, row.id)}
              >
                {row.name}
              </Link>
            ),
          },
          { id: "status", header: "Estado", cell: (row) => row.status ?? "—" },
        ]}
        emptyMessage="Sin ad sets."
      />
      <h3 className="text-sm font-semibold">Pedidos atribuidos (primary)</h3>
      <DataTable
        data={attributions}
        getRowId={(row) => row.id}
        columns={[
          {
            id: "order",
            header: "Pedido",
            cell: (row) => (
              <Link
                className="underline text-brand-primary"
                href={routes.store.orderDetail(p.agencySlug, p.storeSlug, row.order_id)}
              >
                {row.order_id.slice(0, 8)}
              </Link>
            ),
          },
          { id: "model", header: "Modelo", cell: (row) => row.model },
          {
            id: "conf",
            header: "Confidence",
            cell: (row) =>
              row.confidence_score != null ? row.confidence_score.toFixed(2) : "—",
          },
          { id: "reason", header: "Reason", cell: (row) => row.attribution_reason ?? "—" },
          {
            id: "value",
            header: "Valor",
            cell: (row) => Number(row.attributed_value).toFixed(2),
          },
        ]}
        emptyMessage="Sin atribuciones primarias."
      />
    </section>
  );
}
