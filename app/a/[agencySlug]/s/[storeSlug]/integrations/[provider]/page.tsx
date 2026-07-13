import Link from "next/link";
import { IntegrationActions } from "@/components/integrations/IntegrationActions";
import { ShopifyConnectForm } from "@/components/integrations/ShopifyConnectForm";
import {
  Alert,
  DataTable,
  DemoModeBadge,
  ErrorState,
  SectionHeader,
  StatusBadge,
} from "@/components/ui";
import { routes } from "@/config/routes";
import {
  getCatalogEntry,
  isStoreIntegrationProvider,
  labelIntegrationStatus,
  labelSyncStatus,
  labelSyncType,
} from "@/lib/integrations/catalog";
import { isShopifyConfigured } from "@/lib/integrations/shopify/env";
import { isDemoIntegrationMode } from "@/lib/integrations/registry";
import { can } from "@/lib/permissions/can";
import { createClient } from "@/lib/supabase/server";
import { requireStoreAccess } from "@/lib/tenant/require-store-access";
import {
  getByProvider,
  latestHealth,
  listSyncRuns,
} from "@/services/integrations.service";

export default async function IntegrationDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ agencySlug: string; storeSlug: string; provider: string }>;
  searchParams: Promise<{ shopify?: string; shopify_error?: string }>;
}) {
  const p = await params;
  const q = await searchParams;
  const member = await requireStoreAccess(p.agencySlug, p.storeSlug);
  if (!can(member.roles, "integrations.view")) {
    return <ErrorState title="Sin permiso" description="No puedes ver esta integración." />;
  }
  if (!member.storeId) {
    return <ErrorState title="Tienda inválida" description="No se pudo resolver la tienda activa." />;
  }
  if (!isStoreIntegrationProvider(p.provider)) {
    return <ErrorState title="Proveedor desconocido" description="Este proveedor no está en el catálogo de la tienda." />;
  }

  const catalog = getCatalogEntry(p.provider);
  const client = await createClient();
  const integration = await getByProvider(client, member.agencyId, member.storeId, p.provider);
  const connected =
    !!integration && integration.status !== "disconnected" && integration.status !== "revoked";
  const health = integration ? await latestHealth(client, member.agencyId, member.storeId, integration.id) : null;
  const syncRuns = integration
    ? await listSyncRuns(client, member.agencyId, member.storeId, {
        integrationId: integration.id,
        limit: 20,
      })
    : [];
  const demo = isDemoIntegrationMode() || Boolean((integration?.metadata as { demo?: boolean } | null)?.demo);
  const canManage = can(member.roles, "integrations.manage");
  const shopifyLive = p.provider === "shopify" && isShopifyConfigured();
  const shopDomain =
    (integration?.settings as { shop_domain?: string } | null)?.shop_domain ||
    (integration?.metadata as { shop_domain?: string } | null)?.shop_domain ||
    "";

  return (
    <section className="space-y-5">
      <div className="space-y-2">
        <Link
          href={routes.store.integrations(p.agencySlug, p.storeSlug)}
          className="text-sm text-brand-primary hover:underline"
        >
          ← Integraciones
        </Link>
        <SectionHeader
          title={catalog?.name ?? p.provider}
          description={catalog?.description}
          action={demo && !shopifyLive ? <DemoModeBadge /> : null}
        />
      </div>

      {q.shopify === "connected" ? (
        <Alert variant="success" title="Shopify conectado">
          Autorización completa. El access token quedó cifrado para esta tienda.
        </Alert>
      ) : null}
      {q.shopify_error ? (
        <Alert variant="danger" title="Error de OAuth Shopify">
          {q.shopify_error}
        </Alert>
      ) : null}

      {demo && !shopifyLive ? (
        <Alert variant="info" title="Modo demostración">
          Esta conexión usa adaptadores mock. No se realizan llamadas a APIs externas.
        </Alert>
      ) : null}

      {shopifyLive ? (
        <Alert variant="info" title="Shopify live">
          Credenciales de app configuradas. Puedes autorizar una tienda real vía OAuth.
        </Alert>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-lg border border-border bg-surface-elevated p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-text-secondary">Estado</p>
          <div className="mt-2">
            <StatusBadge
              status={integration?.status ?? "disconnected"}
              label={labelIntegrationStatus(integration?.status ?? "disconnected")}
            />
          </div>
        </div>
        <div className="rounded-lg border border-border bg-surface-elevated p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-text-secondary">Último éxito</p>
          <p className="mt-2 text-sm">
            {integration?.last_success_at
              ? new Date(integration.last_success_at).toLocaleString("es-PE")
              : "—"}
          </p>
        </div>
        <div className="rounded-lg border border-border bg-surface-elevated p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-text-secondary">Salud reciente</p>
          <p className="mt-2 text-sm">
            {health
              ? `${health.status} · ${health.latency_ms ?? "—"} ms`
              : "Sin pruebas registradas"}
          </p>
          {health?.safe_message ? (
            <p className="mt-1 text-xs text-text-secondary">{health.safe_message}</p>
          ) : null}
        </div>
      </div>

      {integration?.last_error_message ? (
        <Alert variant="warning" title="Último error seguro">
          {integration.last_error_message}
        </Alert>
      ) : null}

      {shopifyLive && canManage ? (
        <ShopifyConnectForm
          agencySlug={p.agencySlug}
          storeSlug={p.storeSlug}
          defaultShop={shopDomain}
        />
      ) : null}

      <IntegrationActions
        agencySlug={p.agencySlug}
        storeSlug={p.storeSlug}
        provider={p.provider}
        canManage={canManage}
        connected={connected}
        hideMockConnect={shopifyLive}
      />

      <div className="space-y-3">
        <SectionHeader title="Historial de sincronización" description="Ejecuciones recientes de esta integración." />
        <DataTable
          columns={[
            {
              id: "created",
              header: "Inicio",
              cell: (row) => new Date(row.created_at).toLocaleString("es-PE"),
            },
            {
              id: "type",
              header: "Tipo",
              cell: (row) => labelSyncType(row.sync_type),
            },
            {
              id: "status",
              header: "Estado",
              cell: (row) => <StatusBadge status={row.status} label={labelSyncStatus(row.status)} />,
            },
            {
              id: "totals",
              header: "Totales",
              cell: (row) =>
                `${row.created_total} creados · ${row.updated_total} act. · ${row.skipped_total} omit. · ${row.failed_total} fallos`,
            },
            {
              id: "link",
              header: "",
              cell: (row) => (
                <Link
                  href={routes.store.syncRunDetail(p.agencySlug, p.storeSlug, row.id)}
                  className="text-sm text-brand-primary hover:underline"
                >
                  Ver
                </Link>
              ),
            },
          ]}
          data={syncRuns}
          getRowId={(row) => row.id}
          emptyMessage="Aún no hay sincronizaciones para esta integración."
        />
      </div>
    </section>
  );
}
