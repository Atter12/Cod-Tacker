import Link from "next/link";
import { Suspense } from "react";
import { AnalyticsFiltersForm } from "@/components/attribution/AnalyticsFiltersForm";
import {
  DataTable,
  ErrorState,
  SectionHeader,
  Skeleton,
  Tooltip,
} from "@/components/ui";
import { routes } from "@/config/routes";
import { formatRoas } from "@/lib/attribution/metrics";
import { parseDateParam, type SearchParamsRecord } from "@/lib/http/search-params";
import { can } from "@/lib/permissions/can";
import { createClient } from "@/lib/supabase/server";
import { requireStoreAccess } from "@/lib/tenant/require-store-access";
import { listCampaigns } from "@/services/campaigns.service";

export default async function CampaignsPage({
  params,
  searchParams,
}: {
  params: Promise<{ agencySlug: string; storeSlug: string }>;
  searchParams: Promise<SearchParamsRecord>;
}) {
  const p = await params;
  const sp = await searchParams;
  const member = await requireStoreAccess(p.agencySlug, p.storeSlug);
  if (!can(member.roles, "attribution.view") || !member.storeId) {
    return <ErrorState title="Sin permiso" description="No puedes ver campañas." />;
  }

  const to = parseDateParam(sp, "to") ?? new Date().toISOString();
  const fromDefault = new Date();
  fromDefault.setDate(fromDefault.getDate() - 30);
  const from = parseDateParam(sp, "from") ?? fromDefault.toISOString();

  const rows = await listCampaigns(await createClient(), member.storeId, {
    from: from.slice(0, 10),
    to: to.slice(0, 10),
  });

  return (
    <section className="space-y-5">
      <SectionHeader
        title="Campañas"
        description="Drill-down publicitario. ROAS entregado excluye retornos; ROAS conciliado usa settled."
      />
      <Suspense fallback={<Skeleton className="h-10 w-full" />}>
        <AnalyticsFiltersForm showPlatform={false} />
      </Suspense>
      <DataTable
        data={rows}
        getRowId={(row) => row.campaign.id}
        columns={[
          {
            id: "nombre",
            header: "Campaña",
            cell: (row) => (
              <Link
                className="underline text-brand-primary"
                href={routes.store.campaignDetail(p.agencySlug, p.storeSlug, row.campaign.id)}
              >
                {row.campaign.name}
              </Link>
            ),
          },
          { id: "gasto", header: "Gasto", cell: (row) => row.spend.toFixed(2) },
          { id: "pedidos", header: "Pedidos attr.", cell: (row) => String(row.ordersAttributed) },
          {
            id: "roas_g",
            header: "ROAS gen.",
            cell: (row) => (
              <Tooltip content="Revenue atribuido ÷ spend. Null si spend=0.">
                <span>{formatRoas(row.roasGenerated)}</span>
              </Tooltip>
            ),
          },
          {
            id: "roas_d",
            header: "ROAS ent.",
            cell: (row) => formatRoas(row.roasDelivered),
          },
          {
            id: "roas_c",
            header: "ROAS cob.",
            cell: (row) => formatRoas(row.roasCollected),
          },
          {
            id: "roas_s",
            header: "ROAS conc.",
            cell: (row) => formatRoas(row.roasSettled),
          },
        ]}
        emptyMessage="No hay campañas. Siembra atribución mock desde Atribución."
      />
    </section>
  );
}
