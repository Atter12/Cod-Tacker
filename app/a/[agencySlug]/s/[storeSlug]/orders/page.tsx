import Link from "next/link";
import { Suspense } from "react";
import { OrdersStatusTabs } from "@/components/orders/OrdersStatusTabs";
import { OrdersTable } from "@/components/orders/OrdersTable";
import { OrdersToolbar } from "@/components/orders/OrdersToolbar";
import { ErrorState, Skeleton } from "@/components/ui";
import { routes } from "@/config/routes";
import { dateRangeToBounds, parseDateRangePreset } from "@/lib/formatting/date-range";
import {
  parseDateParam,
  parsePaginationParams,
  parseStringParam,
  type SearchParamsRecord,
} from "@/lib/http/search-params";
import { parseOrderListView, statusesForOrderListView } from "@/lib/orders/list-view";
import { can } from "@/lib/permissions/can";
import { createClient } from "@/lib/supabase/server";
import { requireStoreAccess } from "@/lib/tenant/require-store-access";
import { enrichOrdersWithCustomers, listOrders } from "@/services/orders.service";
import type {
  ConfirmationStatus,
  OrderSortField,
  OrderStatus,
  PaymentStatus,
  SortDirection,
} from "@/types/orders";

function hasAdvancedFilters(params: SearchParamsRecord): boolean {
  return Boolean(
    parseStringParam(params, "payment") ||
      parseStringParam(params, "confirmation") ||
      parseStringParam(params, "city") ||
      parseStringParam(params, "district") ||
      parseStringParam(params, "minAmount") ||
      parseStringParam(params, "maxAmount") ||
      parseDateParam(params, "from") ||
      parseDateParam(params, "to") ||
      (parseStringParam(params, "sortBy") && parseStringParam(params, "sortBy") !== "created_at_source") ||
      (parseStringParam(params, "sortDir") && parseStringParam(params, "sortDir") !== "desc"),
  );
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
  const view = parseOrderListView(parseStringParam(sp, "view"));
  const statusParam = parseStringParam(sp, "status") as OrderStatus | undefined;
  const payment = parseStringParam(sp, "payment") as PaymentStatus | undefined;
  const confirmation = parseStringParam(sp, "confirmation") as ConfirmationStatus | undefined;
  const sortBy = (parseStringParam(sp, "sortBy") as OrderSortField | undefined) ?? "created_at_source";
  const sortDir = (parseStringParam(sp, "sortDir") as SortDirection | undefined) ?? "desc";
  const minAmountRaw = parseStringParam(sp, "minAmount");
  const maxAmountRaw = parseStringParam(sp, "maxAmount");
  const minAmount = minAmountRaw != null ? Number(minAmountRaw) : undefined;
  const maxAmount = maxAmountRaw != null ? Number(maxAmountRaw) : undefined;
  const customFrom = parseDateParam(sp, "from");
  const customTo = parseDateParam(sp, "to");
  const rangePreset = parseDateRangePreset(parseStringParam(sp, "range"));
  const advancedActive = hasAdvancedFilters(sp);

  let fromIso: string | undefined;
  let toIso: string | undefined;
  if (customFrom || customTo) {
    fromIso = customFrom ? new Date(customFrom).toISOString() : undefined;
    toIso = customTo ? new Date(`${customTo}T23:59:59.999`).toISOString() : undefined;
  } else {
    const bounds = dateRangeToBounds(rangePreset);
    fromIso = bounds.from.toISOString();
    toIso = bounds.to.toISOString();
  }

  const viewStatuses = statusesForOrderListView(view);
  const statuses = statusParam ? [statusParam] : viewStatuses;

  let result;
  try {
    const client = await createClient();
    result = await listOrders(client, {
      storeId: member.storeId,
      page: pagination.page,
      pageSize: pagination.pageSize,
      search: parseStringParam(sp, "q"),
      statuses,
      paymentStatuses: payment ? [payment] : undefined,
      confirmationStatuses: confirmation ? [confirmation] : undefined,
      city: parseStringParam(sp, "city"),
      district: parseStringParam(sp, "district"),
      minAmount: Number.isFinite(minAmount) ? minAmount : undefined,
      maxAmount: Number.isFinite(maxAmount) ? maxAmount : undefined,
      from: fromIso,
      to: toIso,
      sortBy,
      sortDir,
    });
    result = {
      ...result,
      data: await enrichOrdersWithCustomers(client, member.storeId, result.data),
    };
  } catch {
    return <ErrorState title="Error al cargar pedidos" description="Inténtalo de nuevo en unos momentos." />;
  }

  const totalPages = Math.max(1, Math.ceil(result.total / result.pageSize));
  const buildPageHref = (page: number) => {
    const next = new URLSearchParams();
    for (const [key, value] of Object.entries(sp)) {
      const v = Array.isArray(value) ? value[0] : value;
      if (v) next.set(key, v);
    }
    if (!next.get("range") && !next.get("from") && !next.get("to")) {
      next.set("range", rangePreset);
    }
    next.set("page", String(page));
    return `${routes.store.orders(p.agencySlug, p.storeSlug)}?${next.toString()}`;
  };

  return (
    <section className="space-y-4">
      <header>
        <h1 className="text-[24px] font-bold leading-[30px] tracking-tight text-text-primary">Pedidos</h1>
        <p className="mt-0.5 text-[13px] text-text-secondary">
          Gestión de pedidos, estados y entregas recientes.
        </p>
      </header>

      <Suspense fallback={<Skeleton className="h-9 w-full max-w-xl" />}>
        <OrdersStatusTabs activeView={view} />
      </Suspense>

      <Suspense fallback={<Skeleton className="h-11 w-full" />}>
        <OrdersToolbar
          advancedActive={advancedActive}
          initial={{
            q: parseStringParam(sp, "q"),
            payment,
            confirmation,
            city: parseStringParam(sp, "city"),
            district: parseStringParam(sp, "district"),
            minAmount: minAmountRaw,
            maxAmount: maxAmountRaw,
            from: customFrom,
            to: customTo,
            sortBy,
            sortDir,
          }}
        />
      </Suspense>

      <OrdersTable
        orders={result.data}
        agencySlug={p.agencySlug}
        storeSlug={p.storeSlug}
      />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-[12.5px] text-text-secondary">
          {result.total.toLocaleString("es-PE")} pedido{result.total === 1 ? "" : "s"}
          {totalPages > 1 ? ` · Página ${result.page} de ${totalPages}` : null}
        </p>
        {totalPages > 1 ? (
          <nav aria-label="Paginación" className="flex gap-2 text-[12.5px]">
            {result.page > 1 ? (
              <Link
                className="rounded-md border border-border bg-surface-elevated px-3 py-1.5 hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                href={buildPageHref(result.page - 1)}
              >
                Anterior
              </Link>
            ) : null}
            {result.page < totalPages ? (
              <Link
                className="rounded-md border border-border bg-surface-elevated px-3 py-1.5 hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                href={buildPageHref(result.page + 1)}
              >
                Siguiente
              </Link>
            ) : null}
          </nav>
        ) : null}
      </div>

      <div>
        <Link
          href={routes.store.dashboard(p.agencySlug, p.storeSlug)}
          className="inline-flex h-9 items-center justify-center rounded-md border border-brand-primary px-3.5 text-[12.5px] font-medium text-brand-primary transition-colors hover:bg-brand-softer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          Volver al resumen
        </Link>
      </div>
    </section>
  );
}
