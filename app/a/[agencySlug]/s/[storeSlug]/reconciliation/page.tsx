import Link from "next/link";
import { Suspense } from "react";
import { EcartPayPanel } from "@/components/reconciliation/EcartPayPanel";
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
import {
  parseDateParam,
  parseEnumParam,
  parsePaginationParams,
  type SearchParamsRecord,
} from "@/lib/http/search-params";
import { BATCH_STATUS_OPTIONS, labelBatchStatus } from "@/lib/reconciliation/labels";
import { can } from "@/lib/permissions/can";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { requireStoreAccess } from "@/lib/tenant/require-store-access";
import { listSettlementBatchesPaginated } from "@/services/reconciliation.service";
import type { Enums } from "@/types/database.generated";

function formatMoney(amount: number, currency: string) {
  return new Intl.NumberFormat("es-PE", { style: "currency", currency }).format(amount);
}

async function storeHasEcartPay(storeId: string, agencyId: string): Promise<boolean> {
  const admin = createAdminClient();
  const result = await admin
    .from("integrations")
    .select("id, settings, status")
    .eq("store_id", storeId)
    .eq("agency_id", agencyId)
    .eq("provider", "custom_payment")
    .eq("status", "connected")
    .limit(20);
  return (result.data ?? []).some((row) => {
    const settings =
      row.settings && typeof row.settings === "object" && !Array.isArray(row.settings)
        ? (row.settings as Record<string, unknown>)
        : {};
    return settings.gateway === "ecart_pay";
  });
}

export default async function ReconciliationPage({
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
    return (
      <ErrorState title="Sin permiso" description="No puedes ver conciliación en esta tienda." />
    );
  }
  if (!member.storeId || !member.agencyId) {
    return <ErrorState title="Tienda inválida" description="No se pudo resolver la tienda activa." />;
  }

  const pagination = parsePaginationParams(sp, { pageSize: 25 });
  const statusValues = BATCH_STATUS_OPTIONS.map((o) => o.value);
  const status = parseEnumParam(sp, "status", statusValues);
  const from = parseDateParam(sp, "from");
  const to = parseDateParam(sp, "to");

  let result;
  try {
    result = await listSettlementBatchesPaginated(await createClient(), {
      storeId: member.storeId,
      page: pagination.page,
      pageSize: pagination.pageSize,
      statuses: status ? [status as Enums<"reconciliation_status">] : undefined,
      from: from ?? "1970-01-01",
      to: to ?? new Date().toISOString(),
    });
  } catch {
    return <ErrorState title="Error" description="No se pudieron cargar los lotes." />;
  }

  const canManage = can(member.roles, "reconciliation.manage");
  const ecartConnected = await storeHasEcartPay(member.storeId, member.agencyId);

  return (
    <section className="space-y-5">
      <SectionHeader
        title="Conciliación"
        description="Verdad de caja para ROAS: CSV del courier o sync Ecart Pay (COD Envia). Entregado ≠ liquidado."
        action={
          <div className="flex flex-wrap gap-2 text-sm">
            {canManage && (
              <Link
                className="underline text-brand-primary"
                href={routes.store.reconciliationImport(p.agencySlug, p.storeSlug)}
              >
                Importar CSV
              </Link>
            )}
            <Link
              className="underline text-brand-primary"
              href={routes.store.reconciliationDiscrepancies(p.agencySlug, p.storeSlug)}
            >
              Discrepancias
            </Link>
          </div>
        }
      />
      <EcartPayPanel
        agencySlug={p.agencySlug}
        storeSlug={p.storeSlug}
        connected={ecartConnected}
        canManage={canManage}
      />
      <Suspense fallback={<Skeleton className="h-10 w-full" />}>
        <ReconciliationFiltersForm mode="batches" />
      </Suspense>
      {result.rows.length === 0 ? (
        <EmptyState
          title="Sin lotes de liquidación"
          description="Importa un CSV de liquidación del courier o sincroniza Ecart Pay (si usas COD de Envia)."
        />
      ) : (
        <DataTable
          data={result.rows}
          getRowId={(row) => row.id}
          columns={[
            {
              id: "ref",
              header: "Referencia",
              cell: (row) => (
                <Link
                  className="underline text-brand-primary"
                  href={routes.store.reconciliationBatch(p.agencySlug, p.storeSlug, row.id)}
                >
                  {row.reference ?? row.external_batch_id ?? row.id.slice(0, 8)}
                </Link>
              ),
            },
            {
              id: "status",
              header: "Estado",
              cell: (row) => (
                <StatusBadge status={row.status} label={labelBatchStatus(row.status)} />
              ),
            },
            {
              id: "gross",
              header: "Bruto",
              cell: (row) => formatMoney(row.gross_amount, row.currency_code),
            },
            {
              id: "fees",
              header: "Fees",
              cell: (row) => formatMoney(row.fees_amount, row.currency_code),
            },
            {
              id: "net",
              header: "Neto",
              cell: (row) => formatMoney(row.net_amount, row.currency_code),
            },
            {
              id: "approved",
              header: "Liquidado",
              cell: (row) => (row.approved_at ? "Sí" : "No"),
            },
          ]}
          emptyMessage="No hay liquidaciones para mostrar."
        />
      )}
      {result.total > result.pageSize && (
        <p className="text-sm text-text-secondary">
          Página {result.page} · {result.total} lotes
        </p>
      )}
    </section>
  );
}
