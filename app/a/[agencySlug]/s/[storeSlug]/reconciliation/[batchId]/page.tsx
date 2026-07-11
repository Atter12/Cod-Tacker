import Link from "next/link";
import { Suspense } from "react";
import {
  BatchActionsPanel,
  ItemActionsPanel,
} from "@/components/reconciliation/BatchActionsPanel";
import { ReconciliationFiltersForm } from "@/components/reconciliation/ReconciliationFiltersForm";
import {
  DataTable,
  ErrorState,
  MetricCard,
  SectionHeader,
  Skeleton,
  StatusBadge,
} from "@/components/ui";
import { routes } from "@/config/routes";
import {
  parseEnumParam,
  parsePaginationParams,
  type SearchParamsRecord,
} from "@/lib/http/search-params";
import {
  labelBatchStatus,
  labelMatchMethod,
  labelMatchStatus,
  MATCH_STATUS_OPTIONS,
} from "@/lib/reconciliation/labels";
import { can } from "@/lib/permissions/can";
import { createClient } from "@/lib/supabase/server";
import { requireStoreAccess } from "@/lib/tenant/require-store-access";
import {
  countBatchMatchStatuses,
  getSettlementBatchById,
  listSettlementItemsPaginated,
} from "@/services/reconciliation.service";
import type { Enums } from "@/types/database.generated";

function formatMoney(amount: number, currency: string) {
  return new Intl.NumberFormat("es-PE", { style: "currency", currency }).format(amount);
}

export default async function ReconciliationBatchPage({
  params,
  searchParams,
}: {
  params: Promise<{ agencySlug: string; storeSlug: string; batchId: string }>;
  searchParams: Promise<SearchParamsRecord>;
}) {
  const p = await params;
  const sp = await searchParams;
  const member = await requireStoreAccess(p.agencySlug, p.storeSlug);
  if (!can(member.roles, "reconciliation.view") && !can(member.roles, "reconciliation.manage")) {
    return <ErrorState title="Sin permiso" description="No puedes ver este lote." />;
  }
  if (!member.storeId) {
    return <ErrorState title="Tienda inválida" description="Tienda no resuelta." />;
  }

  const client = await createClient();
  const batch = await getSettlementBatchById(client, member.storeId, p.batchId);
  if (!batch) {
    return <ErrorState title="No encontrado" description="El lote no existe en esta tienda." />;
  }

  const pagination = parsePaginationParams(sp, { pageSize: 25 });
  const matchStatus = parseEnumParam(
    sp,
    "matchStatus",
    MATCH_STATUS_OPTIONS.map((o) => o.value),
  );

  const [items, counts] = await Promise.all([
    listSettlementItemsPaginated(client, {
      storeId: member.storeId,
      batchId: batch.id,
      page: pagination.page,
      pageSize: pagination.pageSize,
      matchStatuses: matchStatus
        ? [matchStatus as Enums<"settlement_match_status">]
        : undefined,
    }),
    countBatchMatchStatuses(client, member.storeId, batch.id),
  ]);

  const canManage = can(member.roles, "reconciliation.manage");
  const processing =
    batch.processing_started_at && !batch.processing_finished_at
      ? "En proceso"
      : batch.processing_finished_at
        ? "Procesado"
        : "Pendiente";

  return (
    <section className="space-y-5">
      <SectionHeader
        title={batch.reference ?? batch.external_batch_id ?? "Lote"}
        description={`Estado: ${labelBatchStatus(batch.status)} · ${processing}`}
        action={
          <Link
            className="text-sm underline text-brand-primary"
            href={routes.store.reconciliation(p.agencySlug, p.storeSlug)}
          >
            Volver
          </Link>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard label="Bruto" value={formatMoney(batch.gross_amount, batch.currency_code)} />
        <MetricCard label="Fees" value={formatMoney(batch.fees_amount, batch.currency_code)} />
        <MetricCard
          label="Ajustes"
          value={formatMoney(batch.adjustments_amount, batch.currency_code)}
        />
        <MetricCard label="Neto" value={formatMoney(batch.net_amount, batch.currency_code)} />
      </div>

      <div className="flex flex-wrap gap-3 text-sm text-text-secondary">
        <span>Emparejados: {counts.matched}</span>
        <span>Sin match: {counts.unmatched}</span>
        <span>Diferencia: {counts.difference}</span>
        <span>Duplicados: {counts.duplicate}</span>
        <span>Disputados: {counts.disputed}</span>
        <span>Resueltos: {counts.resolved}</span>
      </div>

      <BatchActionsPanel
        agencySlug={p.agencySlug}
        storeSlug={p.storeSlug}
        batchId={batch.id}
        approved={Boolean(batch.approved_at)}
        canManage={canManage}
      />

      <Suspense fallback={<Skeleton className="h-10 w-full" />}>
        <ReconciliationFiltersForm mode="items" />
      </Suspense>

      <DataTable
        data={items.rows}
        getRowId={(row) => row.id}
        columns={[
          {
            id: "row",
            header: "Fila",
            cell: (row) => row.source_row_number ?? "—",
          },
          {
            id: "tracking",
            header: "Tracking",
            cell: (row) => row.tracking_number ?? "—",
          },
          {
            id: "match",
            header: "Match",
            cell: (row) => (
              <StatusBadge
                status={row.match_status}
                label={labelMatchStatus(row.match_status)}
              />
            ),
          },
          {
            id: "method",
            header: "Método",
            cell: (row) => labelMatchMethod(row.match_method),
          },
          {
            id: "expected",
            header: "Esperado",
            cell: (row) =>
              row.expected_amount != null
                ? formatMoney(row.expected_amount, batch.currency_code)
                : "—",
          },
          {
            id: "settled",
            header: "Neto fila",
            cell: (row) => formatMoney(row.settled_amount, batch.currency_code),
          },
          {
            id: "diff",
            header: "Diff",
            cell: (row) =>
              row.difference_amount != null
                ? formatMoney(row.difference_amount, batch.currency_code)
                : "—",
          },
          {
            id: "reason",
            header: "Motivo",
            cell: (row) => row.discrepancy_reason ?? "—",
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
        emptyMessage="Sin ítems en este lote."
      />
    </section>
  );
}
