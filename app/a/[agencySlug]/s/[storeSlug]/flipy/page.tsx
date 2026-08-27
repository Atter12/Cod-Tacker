import Link from "next/link";
import { Suspense } from "react";
import { FlipyInboxFiltersForm } from "@/components/flipy/FlipyInboxFiltersForm";
import {
  DataTable,
  EmptyState,
  ErrorState,
  PageHeader,
  Skeleton,
  StatusBadge,
} from "@/components/ui";
import { routes } from "@/config/routes";
import {
  parseEnumParam,
  parsePaginationParams,
  parseStringParam,
  type SearchParamsRecord,
} from "@/lib/http/search-params";
import { listFlipyInboxForStore } from "@/lib/integrations/flipy/inbox-service";
import type { FlipyAttentionTag, FlipyEnviosInboxScope } from "@/lib/integrations/flipy/partner-contract";
import {
  readFlipyTiendaId,
  resolveFlipyPartnerKeyFromIntegration,
} from "@/lib/integrations/flipy/credentials";
import { resolveFlipyIntegrationForStore } from "@/lib/integrations/flipy/webhook-ingress";
import { getIntegrationRuntimeMode } from "@/lib/integrations/registry";
import { can } from "@/lib/permissions/can";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireStoreAccess } from "@/lib/tenant/require-store-access";

const SCOPES: FlipyEnviosInboxScope[] = ["atencion", "activos", "historial", "all"];

function attentionLabel(tag: FlipyAttentionTag): string {
  if (tag === "bids") return "Pujas";
  if (tag === "waiting") return "En espera";
  return "Devolución";
}

function formatWhen(value: string | null | undefined): string {
  if (!value) return "—";
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "—";
  return new Intl.DateTimeFormat("es-PE", { dateStyle: "short", timeStyle: "short" }).format(date);
}

export default async function FlipyInboxPage({
  params,
  searchParams,
}: {
  params: Promise<{ agencySlug: string; storeSlug: string }>;
  searchParams: Promise<SearchParamsRecord>;
}) {
  const p = await params;
  const sp = await searchParams;
  const member = await requireStoreAccess(p.agencySlug, p.storeSlug);
  if (!can(member.roles, "orders.view") && !can(member.roles, "shipments.view")) {
    return <ErrorState title="Sin permiso" description="No puedes ver el inbox Flipy." />;
  }
  if (!member.storeId) {
    return <ErrorState title="Tienda inválida" description="No se pudo resolver la tienda activa." />;
  }

  if (getIntegrationRuntimeMode() !== "live") {
    return (
      <section className="space-y-6">
        <PageHeader
          title="Flipy"
          description="Bandeja operativa de envíos Flipy (contrato 0.2.2)."
        />
        <EmptyState
          title="Integraciones en modo demo"
          description="El inbox Flipy solo está disponible con INTEGRATION_MODE=live."
        />
      </section>
    );
  }

  const admin = createAdminClient();
  const integration = await resolveFlipyIntegrationForStore(admin, member.agencyId, member.storeId);
  const connected =
    !!integration &&
    integration.status !== "disconnected" &&
    integration.status !== "revoked" &&
    !!readFlipyTiendaId(integration.settings) &&
    !!resolveFlipyPartnerKeyFromIntegration(integration);

  if (!connected) {
    return (
      <section className="space-y-6">
        <PageHeader
          title="Flipy"
          description="Bandeja operativa de envíos Flipy (contrato 0.2.2)."
        />
        <EmptyState
          title="Flipy no conectado"
          description="Conecta Flipy en Integraciones para ver envíos activos, pujas y atención."
          action={{
            label: "Ir a Integraciones → Flipy",
            href: routes.store.integrationDetail(p.agencySlug, p.storeSlug, "flipy"),
          }}
        />
      </section>
    );
  }

  const pagination = parsePaginationParams(sp, { pageSize: 25 });
  const scope = (parseEnumParam(sp, "scope", SCOPES) ?? "atencion") as FlipyEnviosInboxScope;
  const q = parseStringParam(sp, "q") ?? "";
  const estado = parseStringParam(sp, "estado") ?? "";

  let inbox;
  try {
    inbox = await listFlipyInboxForStore({
      admin,
      agencyId: member.agencyId,
      storeId: member.storeId,
      scope,
      estado: estado || null,
      q: q || null,
      page: pagination.page,
      pageSize: pagination.pageSize,
    });
  } catch {
    return (
      <ErrorState
        title="No se pudo cargar el inbox Flipy"
        description="Revisa la conexión Partner o inténtalo de nuevo en unos momentos."
      />
    );
  }

  const totalPages = Math.max(1, Math.ceil(inbox.total / inbox.pageSize));
  const buildPageHref = (page: number) => {
    const params = new URLSearchParams();
    params.set("scope", scope);
    if (q) params.set("q", q);
    if (estado) params.set("estado", estado);
    if (page > 1) params.set("page", String(page));
    const qs = params.toString();
    return `${routes.store.flipy(p.agencySlug, p.storeSlug)}${qs ? `?${qs}` : ""}`;
  };

  return (
    <section className="space-y-6">
      <PageHeader
        title="Flipy"
        description="Inbox Partner: atención, activos e historial. Chat, evidencias, retiros y cuenta siguen en Flipy."
        actions={
          <Link
            href={routes.store.integrationDetail(p.agencySlug, p.storeSlug, "flipy")}
            className="text-sm text-text-secondary hover:text-text-primary hover:underline"
          >
            Integración
          </Link>
        }
      />

      <Suspense fallback={<Skeleton className="h-24 w-full" />}>
        <FlipyInboxFiltersForm scope={scope} q={q} estado={estado} />
      </Suspense>

      {inbox.rows.length === 0 ? (
        <EmptyState
          title="Sin envíos en esta bandeja"
          description={
            scope === "atencion"
              ? "No hay pujas, esperas ni devoluciones pendientes ahora."
              : "Prueba otro scope o quita filtros."
          }
        />
      ) : (
        <div className="space-y-3">
          <p className="text-[12.5px] text-text-secondary">
            {inbox.total.toLocaleString("es-PE")} envío{inbox.total === 1 ? "" : "s"} · página{" "}
            {inbox.page} de {totalPages}
          </p>
          <DataTable
            data={inbox.rows}
            getRowId={(row) => row.envioId}
            columns={[
              {
                id: "pedido",
                header: "Pedido",
                cell: (row) =>
                  row.orderLink ? (
                    <Link
                      href={routes.store.orderDetail(
                        p.agencySlug,
                        p.storeSlug,
                        row.orderLink.orderId,
                      )}
                      className="font-medium text-brand-primary hover:underline"
                    >
                      {row.orderLink.orderNumber ?? row.orderLink.externalOrderId}
                    </Link>
                  ) : (
                    <span className="text-text-secondary">
                      {row.title ?? row.externalOrderId ?? "—"}
                    </span>
                  ),
              },
              {
                id: "estado",
                header: "Estado",
                cell: (row) => <StatusBadge status={row.estado} label={row.estado} />,
              },
              {
                id: "tags",
                header: "Atención",
                cell: (row) =>
                  row.attentionTags.length ? (
                    <span className="flex flex-wrap gap-1">
                      {row.attentionTags.map((tag) => (
                        <span
                          key={tag}
                          className="rounded-md bg-brand-softer px-1.5 py-0.5 text-[11px] font-medium text-brand-primary"
                        >
                          {attentionLabel(tag)}
                        </span>
                      ))}
                    </span>
                  ) : (
                    "—"
                  ),
              },
              {
                id: "modo",
                header: "Modo",
                cell: (row) => row.fulfillmentMode ?? "—",
              },
              {
                id: "moto",
                header: "Motorizado",
                cell: (row) =>
                  row.assignedMotorizado?.displayName ??
                  (row.bidsCount != null ? `${row.bidsCount} pujas` : "—"),
              },
              {
                id: "updated",
                header: "Actualizado",
                cell: (row) => formatWhen(row.updatedAt ?? row.createdAt),
              },
              {
                id: "acciones",
                header: "",
                cell: (row) =>
                  row.appWebUrl ? (
                    <a
                      href={row.appWebUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs font-medium text-text-secondary hover:text-text-primary hover:underline"
                    >
                      Abrir en Flipy
                    </a>
                  ) : null,
              },
            ]}
          />
          {totalPages > 1 ? (
            <div className="flex items-center justify-between gap-3 text-sm">
              <Link
                href={buildPageHref(Math.max(1, inbox.page - 1))}
                className={inbox.page <= 1 ? "pointer-events-none opacity-40" : "hover:underline"}
                aria-disabled={inbox.page <= 1}
              >
                ← Anterior
              </Link>
              <Link
                href={buildPageHref(Math.min(totalPages, inbox.page + 1))}
                className={
                  inbox.page >= totalPages ? "pointer-events-none opacity-40" : "hover:underline"
                }
                aria-disabled={inbox.page >= totalPages}
              >
                Siguiente →
              </Link>
            </div>
          ) : null}
        </div>
      )}
    </section>
  );
}
