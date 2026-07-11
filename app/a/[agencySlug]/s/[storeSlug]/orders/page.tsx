import Link from "next/link";
import { Suspense } from "react";
import { OrdersFiltersForm } from "@/components/orders/OrdersFiltersForm";
import {
  ConfirmationStatusBadge,
  DataTable,
  EmptyState,
  ErrorState,
  OrderStatusBadge,
  PaymentStatusBadge,
  SectionHeader,
  Skeleton,
} from "@/components/ui";
import { routes } from "@/config/routes";
import { formatCurrency } from "@/lib/formatting/currency";
import { parseDateParam, parsePaginationParams, parseStringParam, type SearchParamsRecord } from "@/lib/http/search-params";
import { can } from "@/lib/permissions/can";
import { createClient } from "@/lib/supabase/server";
import { requireStoreAccess } from "@/lib/tenant/require-store-access";
import { listOrders } from "@/services/orders.service";
import type { ConfirmationStatus, OrderSortField, OrderStatus, PaymentStatus, SortDirection } from "@/types/orders";

function activeFilterSummary(params: SearchParamsRecord): string[] {
  const labels: string[] = [];
  if (parseStringParam(params, "q")) labels.push("búsqueda");
  if (parseStringParam(params, "status")) labels.push("estado");
  if (parseStringParam(params, "payment")) labels.push("pago");
  if (parseStringParam(params, "confirmation")) labels.push("confirmación");
  if (parseStringParam(params, "city")) labels.push("ciudad");
  if (parseStringParam(params, "district")) labels.push("distrito");
  if (parseStringParam(params, "minAmount") || parseStringParam(params, "maxAmount")) labels.push("monto");
  if (parseDateParam(params, "from") || parseDateParam(params, "to")) labels.push("fechas");
  return labels;
}

export default async function OrdersPage({
  params,
  searchParams,
}: {
  params: Promise<{ agencySlug: string; storeSlug: string }>;
  searchParams: Promise<SearchParamsRecord>;
}) {
  const p = await params;
  const sp = await searchParams;
  const member = await requireStoreAccess(p.agencySlug, p.storeSlug);
  if (!can(member.roles, "orders.view")) {
    return <ErrorState title="Sin permiso" description="No puedes ver pedidos en esta tienda." />;
  }
  if (!member.storeId) {
    return <ErrorState title="Tienda inválida" description="No se pudo resolver la tienda activa." />;
  }

  const pagination = parsePaginationParams(sp, { pageSize: 25 });
  const status = parseStringParam(sp, "status") as OrderStatus | undefined;
  const payment = parseStringParam(sp, "payment") as PaymentStatus | undefined;
  const confirmation = parseStringParam(sp, "confirmation") as ConfirmationStatus | undefined;
  const sortBy = (parseStringParam(sp, "sortBy") as OrderSortField | undefined) ?? "created_at_source";
  const sortDir = (parseStringParam(sp, "sortDir") as SortDirection | undefined) ?? "desc";
  const minAmountRaw = parseStringParam(sp, "minAmount");
  const maxAmountRaw = parseStringParam(sp, "maxAmount");
  const minAmount = minAmountRaw != null ? Number(minAmountRaw) : undefined;
  const maxAmount = maxAmountRaw != null ? Number(maxAmountRaw) : undefined;
  const from = parseDateParam(sp, "from");
  const to = parseDateParam(sp, "to");
  const filtersActive = activeFilterSummary(sp);

  let result;
  try {
    result = await listOrders(await createClient(), {
      storeId: member.storeId,
      page: pagination.page,
      pageSize: pagination.pageSize,
      search: parseStringParam(sp, "q"),
      statuses: status ? [status] : undefined,
      paymentStatuses: payment ? [payment] : undefined,
      confirmationStatuses: confirmation ? [confirmation] : undefined,
      city: parseStringParam(sp, "city"),
      district: parseStringParam(sp, "district"),
      minAmount: Number.isFinite(minAmount) ? minAmount : undefined,
      maxAmount: Number.isFinite(maxAmount) ? maxAmount : undefined,
      from: from ? new Date(from).toISOString() : undefined,
      to: to ? new Date(`${to}T23:59:59.999`).toISOString() : undefined,
      sortBy,
      sortDir,
    });
  } catch {
    return <ErrorState title="Error al cargar pedidos" description="Inténtalo de nuevo en unos momentos." />;
  }

  const totalPages = Math.max(1, Math.ceil(result.total / result.pageSize));
  const buildPageHref = (page: number) => {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(sp)) {
      const v = Array.isArray(value) ? value[0] : value;
      if (v) params.set(key, v);
    }
    params.set("page", String(page));
    return `${routes.store.orders(p.agencySlug, p.storeSlug)}?${params.toString()}`;
  };

  return (
    <section className="space-y-5">
      <SectionHeader
        title="Pedidos"
        description={`${result.total} pedido(s)${filtersActive.length ? ` · filtros: ${filtersActive.join(", ")}` : ""}.`}
      />
      <Suspense fallback={<Skeleton className="h-40 w-full" />}>
        <OrdersFiltersForm
          initial={{
            q: parseStringParam(sp, "q"),
            status,
            payment,
            confirmation,
            city: parseStringParam(sp, "city"),
            district: parseStringParam(sp, "district"),
            minAmount: minAmountRaw,
            maxAmount: maxAmountRaw,
            from,
            to,
            sortBy,
            sortDir,
          }}
        />
      </Suspense>

      {result.total === 0 ? (
        <EmptyState
          title="Sin pedidos"
          description="No hay pedidos que coincidan con los filtros actuales."
        />
      ) : (
        <DataTable
          data={result.data}
          getRowId={(row) => row.id}
          emptyMessage="No hay pedidos para mostrar."
          columns={[
            {
              id: "pedido",
              header: "Pedido",
              cell: (row) => (
                <Link
                  className="font-medium text-brand-primary hover:underline"
                  href={routes.store.orderDetail(p.agencySlug, p.storeSlug, row.id)}
                >
                  {row.order_number ?? row.external_order_id}
                </Link>
              ),
            },
            {
              id: "estado",
              header: "Estado",
              cell: (row) => <OrderStatusBadge status={row.order_status} />,
            },
            {
              id: "pago",
              header: "Pago",
              cell: (row) => <PaymentStatusBadge status={row.payment_status} />,
            },
            {
              id: "confirmacion",
              header: "Confirmación",
              cell: (row) => <ConfirmationStatusBadge status={row.confirmation_status} />,
            },
            {
              id: "ciudad",
              header: "Ciudad",
              cell: (row) => row.shipping_city ?? "—",
            },
            {
              id: "total",
              header: "Total",
              cell: (row) => formatCurrency(Number(row.total_amount), row.currency_code),
            },
            {
              id: "fecha",
              header: "Fecha",
              cell: (row) => new Date(row.created_at_source).toLocaleString("es-PE"),
            },
          ]}
        />
      )}

      {totalPages > 1 ? (
        <nav aria-label="Paginación" className="flex items-center justify-between gap-3 text-sm">
          <span className="text-text-secondary">
            Página {result.page} de {totalPages}
          </span>
          <div className="flex gap-2">
            {result.page > 1 ? (
              <Link className="rounded-md border border-border px-3 py-1.5 hover:bg-muted" href={buildPageHref(result.page - 1)}>
                Anterior
              </Link>
            ) : null}
            {result.page < totalPages ? (
              <Link className="rounded-md border border-border px-3 py-1.5 hover:bg-muted" href={buildPageHref(result.page + 1)}>
                Siguiente
              </Link>
            ) : null}
          </div>
        </nav>
      ) : null}
    </section>
  );
}
