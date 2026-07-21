import Link from "next/link";
import { EnviaConnectForm } from "@/components/integrations/EnviaConnectForm";
import { IntegrationActions } from "@/components/integrations/IntegrationActions";
import { ShopifyConnectForm } from "@/components/integrations/ShopifyConnectForm";
import { WhatsAppConnectForm } from "@/components/integrations/WhatsAppConnectForm";
import {
  Alert,
  DataTable,
  DemoModeBadge,
  ErrorState,
  SectionHeader,
  StatusBadge,
} from "@/components/ui";
import { getPublicEnv } from "@/config/env";
import { routes } from "@/config/routes";
import {
  getCatalogEntry,
  isStoreIntegrationProvider,
  labelIntegrationStatus,
  labelSyncStatus,
  labelSyncType,
} from "@/lib/integrations/catalog";
import { buildEnviaWebhookUrls } from "@/lib/integrations/envia/webhook-urls";
import { readMetaAdsCredentialsFromEnv } from "@/lib/integrations/meta/env";
import { readTikTokAdsCredentialsFromEnv } from "@/lib/integrations/tiktok/env";
import { readWhatsAppCredentialsFromEnv } from "@/lib/integrations/whatsapp/env";
import { isShopifyConfigured } from "@/lib/integrations/shopify/env";
import { getIntegrationRuntimeMode, isDemoIntegrationMode } from "@/lib/integrations/registry";
import {
  parseShopifyWebhooksMetadata,
  summarizeShopifyWebhooks,
} from "@/lib/integrations/shopify/webhooks-meta";
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
  const enviaProvider = p.provider === "envia_com";
  const liveMode = getIntegrationRuntimeMode() === "live";
  const metaLive = p.provider === "meta" && liveMode;
  const tiktokLive = p.provider === "tiktok" && liveMode;
  const whatsappLive = p.provider === "whatsapp" && liveMode;
  const metaEnvConfigured = metaLive && !!readMetaAdsCredentialsFromEnv();
  const tiktokEnvConfigured = tiktokLive && !!readTikTokAdsCredentialsFromEnv();
  const whatsappEnvConfigured = whatsappLive && !!readWhatsAppCredentialsFromEnv();
  const adsLive = metaLive || tiktokLive;
  const appUrl = getPublicEnv().NEXT_PUBLIC_APP_URL.replace(/\/$/, "");
  const whatsappWebhookUrl = `${appUrl}/api/integrations/whatsapp/webhooks`;
  const enviaUrls = enviaProvider
    ? buildEnviaWebhookUrls(p.agencySlug, p.storeSlug, getPublicEnv().NEXT_PUBLIC_APP_URL)
    : null;
  const shopDomain =
    (integration?.settings as { shop_domain?: string } | null)?.shop_domain ||
    (integration?.metadata as { shop_domain?: string } | null)?.shop_domain ||
    "";
  const webhooksMeta = shopifyLive ? parseShopifyWebhooksMetadata(integration?.metadata) : null;
  const webhooksSummary = summarizeShopifyWebhooks(webhooksMeta);

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
          action={demo && !shopifyLive && !enviaProvider && !adsLive && !whatsappLive ? <DemoModeBadge /> : null}
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

      {demo && !shopifyLive && !enviaProvider && !adsLive && !whatsappLive ? (
        <Alert variant="info" title="Modo demostración">
          Esta conexión usa adaptadores mock. No se realizan llamadas a APIs externas.
        </Alert>
      ) : null}

      {shopifyLive ? (
        <Alert variant="info" title="Shopify live">
          Credenciales de app configuradas. Puedes autorizar una tienda real vía OAuth.
        </Alert>
      ) : null}

      {metaLive ? (
        <Alert variant="info" title="Meta Ads live">
          {metaEnvConfigured
            ? "Credenciales META_ADS_* detectadas en el entorno. Conectar registra la cuenta de anuncios sin OAuth."
            : "Modo live activo. Configura META_ADS_ACCESS_TOKEN y META_AD_ACCOUNT_ID en Vercel (o ads_access_token + ad_account_id en settings) antes de conectar."}
        </Alert>
      ) : null}

      {tiktokLive ? (
        <Alert variant="info" title="TikTok Ads live">
          {tiktokEnvConfigured
            ? "Credenciales TIKTOK_ADS_* detectadas en el entorno. Conectar registra el advertiser sin OAuth."
            : "Modo live activo. Configura TIKTOK_ADS_ACCESS_TOKEN y TIKTOK_ADVERTISER_ID en Vercel (o ads_access_token + advertiser_id en settings) antes de conectar."}
        </Alert>
      ) : null}

      {whatsappLive ? (
        <Alert variant="info" title="WhatsApp Cloud API live">
          {whatsappEnvConfigured
            ? "Credenciales WHATSAPP_* detectadas en el entorno. También puedes pegar token + phone_number_id abajo."
            : "Modo live activo. Conecta con access token + phone_number_id, y configura WHATSAPP_APP_SECRET + WHATSAPP_VERIFY_TOKEN para el webhook."}
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
          connected={connected}
        />
      ) : null}

      {enviaProvider && canManage && enviaUrls ? (
        <EnviaConnectForm
          agencySlug={p.agencySlug}
          storeSlug={p.storeSlug}
          globalWebhookUrl={enviaUrls.global}
          storeWebhookUrl={enviaUrls.store}
          connected={connected}
          externalAccountId={integration?.external_account_id}
        />
      ) : null}

      {whatsappLive && canManage ? (
        <WhatsAppConnectForm
          agencySlug={p.agencySlug}
          storeSlug={p.storeSlug}
          webhookUrl={whatsappWebhookUrl}
          connected={connected}
          phoneNumberId={integration?.external_account_id}
        />
      ) : null}

      {shopifyLive ? (
        <div className="rounded-lg border border-border bg-surface-elevated p-4">
          <h2 className="text-sm font-semibold">Webhooks Shopify</h2>
          <p className="mt-1 text-[12.5px] text-text-secondary">
            Suscripciones ORDERS_CREATE / ORDERS_UPDATED hacia CODTracked.
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <StatusBadge
              status={
                webhooksSummary.status === "ok"
                  ? "connected"
                  : webhooksSummary.status === "error"
                    ? "error"
                    : webhooksSummary.status === "partial"
                      ? "degraded"
                      : "disconnected"
              }
              label={webhooksSummary.label}
            />
            {webhooksSummary.detail ? (
              <span className="text-[12px] text-text-secondary">{webhooksSummary.detail}</span>
            ) : null}
          </div>
          {webhooksMeta?.callback_uri ? (
            <p className="mt-2 break-all text-[11px] text-text-secondary">{webhooksMeta.callback_uri}</p>
          ) : null}
          {webhooksMeta?.results?.length ? (
            <ul className="mt-2 space-y-1 text-[12px] text-text-secondary">
              {webhooksMeta.results.map((row) => (
                <li key={`${row.topic ?? "topic"}-${row.id ?? row.error ?? "x"}`}>
                  {(row.topic ?? "topic").replaceAll("_", " ")}:{" "}
                  {row.ok ? "OK" : row.error || "falló"}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}

      <IntegrationActions
        agencySlug={p.agencySlug}
        storeSlug={p.storeSlug}
        provider={p.provider}
        canManage={canManage}
        connected={connected}
        hideMockConnect={shopifyLive || whatsappLive || (enviaProvider && liveMode)}
        liveProvider={
          (shopifyLive || enviaProvider || adsLive || whatsappLive) && !isDemoIntegrationMode()
        }
        liveReconnectShop={shopDomain}
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
