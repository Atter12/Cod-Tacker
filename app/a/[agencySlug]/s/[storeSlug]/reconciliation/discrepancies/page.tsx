import Link from "next/link";
import { Suspense } from "react";
import { ItemActionsPanel } from "@/components/reconciliation/BatchActionsPanel";
import { ReconciliationFiltersForm } from "@/components/reconciliation/ReconciliationFiltersForm";
import {
  DataTable,
  EmptyState,
  ErrorState,
  SectionHeader,
  Skeleton,
  StatusBadge,
} from "@/components/ui";
import { routes } from "@/config/routes";
import { parsePaginationParams, type SearchParamsRecord } from "@/lib/http/search-params";
import { labelMatchStatus } from "@/lib/reconciliation/labels";
import { can } from "@/lib/permissions/can";
import { createClient } from "@/lib/supabase/server";
import { requireStoreAccess } from "@/lib/tenant/require-store-access";
import { listSettlementItemsPaginated } from "@/services/reconciliation.service";

export default async function ReconciliationDiscrepanciesPage({
  params,
  searchParams,
}: {
  params: Promise<{ agencySlug: string; storeSlug: string }>;
  searchParams: Promise<SearchParamsRecord>;
}) {
  const p = await params;
  const sp = await searchParams;
  const member = await requireStoreAccess(p.agencySlug, p.storeSlug);
  if (!can(member.roles, "reconciliation.view") && !can(member.roles, "reconciliation.manage")) {
    return <ErrorState title="Sin permiso" description="No puedes ver discrepancias." />;
  }
  if (!member.storeId) {
    return <ErrorState title="Tienda inválida" description="Tienda no resuelta." />;
  }

  const pagination = parsePaginationParams(sp, { pageSize: 25 });
  const items = await listSettlementItemsPaginated(await createClient(), {
    storeId: member.storeId,
    discrepanciesOnly: true,
    page: pagination.page,
    pageSize: pagination.pageSize,
  });

  const canManage = can(member.roles, "reconciliation.manage");

  return (
    <section className="space-y-5">
      <SectionHeader
        title="Discrepancias"
        description="Ítems unmatched, difference, duplicate o disputed pendientes de resolución."
        action={
          <Link
            className="text-sm underline text-brand-primary"
            href={routes.store.reconciliation(p.agencySlug, p.storeSlug)}
          >
            Volver a lotes
          </Link>
        }
      />
      <Suspense fallback={<Skeleton className="h-10 w-full" />}>
        <ReconciliationFiltersForm mode="items" />
      </Suspense>
      {items.rows.length === 0 ? (
        <EmptyState title="Sin discrepancias" description="No hay diferencias abiertas." />
      ) : (
        <DataTable
          data={items.rows}
          getRowId={(row) => row.id}
          columns={[
            {
              id: "batch",
              header: "Lote",
              cell: (row) => (
                <Link
                  className="underline text-brand-primary"
                  href={routes.store.reconciliationBatch(p.agencySlug, p.storeSlug, row.batch_id)}
                >
                  {row.batch_id.slice(0, 8)}
                </Link>
              ),
            },
            {
              id: "tracking",
              header: "Tracking",
              cell: (row) => row.tracking_number ?? row.order_number ?? "—",
            },
            {
              id: "status",
              header: "Estado",
              cell: (row) => (
                <StatusBadge
                  status={row.match_status}
                  label={labelMatchStatus(row.match_status)}
                />
              ),
            },
            {
              id: "reason",
              header: "Motivo",
              cell: (row) => row.discrepancy_reason ?? "—",
            },
            {
              id: "diff",
              header: "Diff",
              cell: (row) => row.difference_amount ?? "—",
            },
            {
              id: "actions",
              header: "Acciones",
              cell: (row) => (
                <ItemActionsPanel
                  agencySlug={p.agencySlug}
                  storeSlug={p.storeSlug}
                  itemId={row.id}
                  matchStatus={row.match_status}
                  canManage={canManage}
                />
              ),
            },
          ]}
          emptyMessage="Sin discrepancias."
        />
      )}
    </section>
  );
}
