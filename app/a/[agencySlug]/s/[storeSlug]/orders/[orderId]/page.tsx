import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ConversionReleasePanel,
  type ConversionReleaseItem,
} from "@/components/orders/ConversionReleasePanel";
import { OrderActionsPanel } from "@/components/orders/OrderActionsPanel";
import { OrdersRealtimeBridge } from "@/components/orders/OrdersRealtimeBridge";
import {
  ConfirmationStatusBadge,
  DataTable,
  EmptyState,
  OrderStatusBadge,
  PaymentStatusBadge,
  SectionHeader,
  Tabs,
} from "@/components/ui";
import { routes } from "@/config/routes";
import { formatCurrency } from "@/lib/formatting/currency";
import { formatDateTime } from "@/lib/formatting/date";
import { displayShopifyContact, missingShopifyContactLabel } from "@/lib/orders/shopify-contact";
import { can } from "@/lib/permissions/can";
import { createClient } from "@/lib/supabase/server";
import { requireStoreAccess } from "@/lib/tenant/require-store-access";
import { getOrderDetail } from "@/services/orders.service";

function maskContact(
  value: string | null | undefined,
  reveal: boolean,
  emptyLabel: string,
): string {
  const trimmed = value?.trim();
  if (!trimmed) return emptyLabel;
  if (reveal) return trimmed;
  if (trimmed.includes("@")) {
    const [user, domain] = trimmed.split("@");
    return `${(user ?? "").slice(0, 2)}***@${domain ?? "***"}`;
  }
  const digits = trimmed.replace(/\D/g, "");
  if (digits.length < 4) return "***";
  return `***${digits.slice(-4)}`;
}

function displayOrDash(value: string | null | undefined): string {
  const trimmed = value?.trim();
  return trimmed ? trimmed : "—";
}

type ShopifyAttributionMeta = {
  has_attribution?: boolean;
  utm_source?: string | null;
  utm_medium?: string | null;
  utm_campaign?: string | null;
  utm_term?: string | null;
  utm_content?: string | null;
  fbclid?: string | null;
  ttclid?: string | null;
  gclid?: string | null;
  platform?: string | null;
};

function readShopifyAttributionMeta(metadata: unknown): ShopifyAttributionMeta | null {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return null;
  const raw = (metadata as Record<string, unknown>).shopify_attribution;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  return raw as ShopifyAttributionMeta;
}

export default async function OrderDetailPage({
  params,
}: {
  params: Promise<{ agencySlug: string; storeSlug: string; orderId: string }>;
}) {
  const p = await params;
  const member = await requireStoreAccess(p.agencySlug, p.storeSlug);
  if (!member.storeId || !can(member.roles, "orders.view")) notFound();

  const client = await createClient();
  const [detail, storeResult] = await Promise.all([
    getOrderDetail(client, member.storeId, p.orderId),
    client.from("stores").select("timezone").eq("id", member.storeId).maybeSingle(),
  ]);
  if (!detail) notFound();

  const storeTimeZone = storeResult.data?.timezone?.trim() || "America/Lima";
  const formatWhen = (value: string) => formatDateTime(value, "es-PE", storeTimeZone);

  const { order, customer } = detail;
  const revealPii = can(member.roles, "orders.manage") || can(member.roles, "agency.manage");
  const canManage = can(member.roles, "orders.manage");
  const primaryAttribution = detail.attributions.find((row) => row.is_primary) ?? detail.attributions[0];
  const shopifyAttribution = readShopifyAttributionMeta(order.metadata);
  const hasShopifySignals = Boolean(shopifyAttribution?.has_attribution);
  const hasLanding = Boolean(order.landing_site?.trim() || order.referring_site?.trim());
  const attributedPlatform = primaryAttribution?.platform ?? null;
  const conversionItems: ConversionReleaseItem[] = detail.conversionEvents
    .slice()
    .sort((a, b) => (a.event_time < b.event_time ? 1 : -1))
    .map((row) => ({
      id: row.id,
      eventName: row.event_name,
      platform: row.platform,
      value: row.value != null ? Number(row.value) : null,
      currencyCode: row.currency_code,
      eventTime: row.event_time,
      deliveryStatus: row.status,
      releaseStatus: row.release_status,
      holdReason: row.hold_reason,
      sentAt: row.sent_at,
      releasedAt: row.released_at,
      lastErrorMessage: row.last_error_message,
      customData: row.custom_data,
      attributedPlatform,
    }));
  const pendingConversions = conversionItems.filter(
    (item) => item.releaseStatus === "pending_review",
  ).length;

  return (
    <section className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link
            href={routes.store.orders(p.agencySlug, p.storeSlug)}
            className="text-xs text-text-secondary hover:text-text-primary hover:underline"
          >
            ← Volver a pedidos
          </Link>
          <SectionHeader
            title={order.order_number ?? order.external_order_id}
            description={`Externo: ${order.external_order_id} · ${formatCurrency(Number(order.total_amount), order.currency_code)}`}
          />
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <OrderStatusBadge status={order.order_status} />
            <PaymentStatusBadge status={order.payment_status} />
            <ConfirmationStatusBadge status={order.confirmation_status} />
            <OrdersRealtimeBridge storeId={member.storeId} orderId={order.id} />
          </div>
        </div>
        <div className="w-full max-w-md">
          <OrderActionsPanel
            agencySlug={p.agencySlug}
            storeSlug={p.storeSlug}
            orderId={order.id}
            canManage={canManage}
          />
        </div>
      </div>

      <Tabs
        defaultValue="resumen"
        tabs={[
          {
            value: "resumen",
            label: "Resumen",
            content: (
              <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 text-sm">
                <div>
                  <dt className="text-text-secondary">Subtotal</dt>
                  <dd>{formatCurrency(Number(order.subtotal_amount), order.currency_code)}</dd>
                </div>
                <div>
                  <dt className="text-text-secondary">Envío</dt>
                  <dd>{formatCurrency(Number(order.shipping_amount), order.currency_code)}</dd>
                </div>
                <div>
                  <dt className="text-text-secondary">Total</dt>
                  <dd className="font-semibold">{formatCurrency(Number(order.total_amount), order.currency_code)}</dd>
                </div>
                <div>
                  <dt className="text-text-secondary">Fuente</dt>
                  <dd>{order.source_name ?? "—"}</dd>
                </div>
                <div>
                  <dt className="text-text-secondary">Tags</dt>
                  <dd>{order.tags?.length ? order.tags.join(", ") : "—"}</dd>
                </div>
                <div>
                  <dt className="text-text-secondary">Creado</dt>
                  <dd>{formatWhen(order.created_at_source)}</dd>
                </div>
              </dl>
            ),
          },
          {
            value: "cliente",
            label: "Cliente y dirección",
            content: (
              <div className="grid gap-4 sm:grid-cols-2 text-sm">
                <div className="space-y-2">
                  <h3 className="font-medium">Cliente</h3>
                  <p>
                    {customer
                      ? displayShopifyContact(
                          `${customer.first_name ?? ""} ${customer.last_name ?? ""}`.trim(),
                          "name",
                          order.source_name,
                        )
                      : "Sin cliente vinculado"}
                  </p>
                  <p>
                    Email:{" "}
                    {maskContact(
                      customer?.email,
                      revealPii,
                      missingShopifyContactLabel("email", order.source_name),
                    )}
                  </p>
                  <p>
                    Teléfono:{" "}
                    {maskContact(
                      customer?.phone,
                      revealPii,
                      missingShopifyContactLabel("phone", order.source_name),
                    )}
                  </p>
                  <p className="text-text-secondary">
                    Historial: {customer?.total_orders ?? 0} pedidos · {customer?.delivered_orders ?? 0}{" "}
                    entregados · {customer?.returned_orders ?? 0} devueltos
                  </p>
                </div>
                <div className="space-y-2">
                  <h3 className="font-medium">Dirección de envío</h3>
                  <p>{[order.shipping_district, order.shipping_city, order.shipping_region].filter(Boolean).join(", ") || "—"}</p>
                  <p>{order.shipping_country_code ?? "—"} {order.shipping_postal_code ?? ""}</p>
                </div>
              </div>
            ),
          },
          {
            value: "productos",
            label: "Productos",
            content: detail.items.length ? (
              <DataTable
                data={detail.items}
                getRowId={(row) => row.id}
                columns={[
                  { id: "title", header: "Producto", cell: (row) => row.title },
                  { id: "sku", header: "SKU", cell: (row) => row.sku ?? "—" },
                  { id: "qty", header: "Cant.", cell: (row) => row.quantity },
                  {
                    id: "total",
                    header: "Total",
                    cell: (row) => formatCurrency(Number(row.total_price), order.currency_code),
                  },
                ]}
              />
            ) : (
              <EmptyState title="Sin ítems" description="Este pedido no tiene líneas de producto." />
            ),
          },
          {
            value: "atribucion",
            label: "Atribución",
            content:
              !hasShopifySignals && !hasLanding ? (
                <EmptyState
                  title="Sin atribución"
                  description={
                    primaryAttribution?.attribution_reason === "Sin atribución"
                      ? "Pedido Shopify sin UTM ni click IDs (nota/landing vacíos)."
                      : "No hay landing/UTM/fbclid asociados a este pedido."
                  }
                />
              ) : (
              <dl className="grid gap-2 text-sm sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <dt className="text-text-secondary">Landing site</dt>
                  <dd className="break-all">{displayOrDash(order.landing_site)}</dd>
                </div>
                <div className="sm:col-span-2">
                  <dt className="text-text-secondary">Referring site</dt>
                  <dd className="break-all">{displayOrDash(order.referring_site)}</dd>
                </div>
                <div>
                  <dt className="text-text-secondary">utm_source</dt>
                  <dd>{displayOrDash(shopifyAttribution?.utm_source)}</dd>
                </div>
                <div>
                  <dt className="text-text-secondary">utm_medium</dt>
                  <dd>{displayOrDash(shopifyAttribution?.utm_medium)}</dd>
                </div>
                <div>
                  <dt className="text-text-secondary">utm_campaign</dt>
                  <dd>{displayOrDash(shopifyAttribution?.utm_campaign)}</dd>
                </div>
                <div>
                  <dt className="text-text-secondary">utm_content</dt>
                  <dd>{displayOrDash(shopifyAttribution?.utm_content)}</dd>
                </div>
                <div>
                  <dt className="text-text-secondary">utm_term</dt>
                  <dd>{displayOrDash(shopifyAttribution?.utm_term)}</dd>
                </div>
                <div>
                  <dt className="text-text-secondary">fbclid</dt>
                  <dd className="break-all">{displayOrDash(shopifyAttribution?.fbclid)}</dd>
                </div>
                <div>
                  <dt className="text-text-secondary">ttclid</dt>
                  <dd className="break-all">{displayOrDash(shopifyAttribution?.ttclid)}</dd>
                </div>
                <div>
                  <dt className="text-text-secondary">gclid</dt>
                  <dd className="break-all">{displayOrDash(shopifyAttribution?.gclid)}</dd>
                </div>
                {primaryAttribution ? (
                  <>
                    <div>
                      <dt className="text-text-secondary">Plataforma</dt>
                      <dd>{primaryAttribution.platform}</dd>
                    </div>
                    <div>
                      <dt className="text-text-secondary">Modelo</dt>
                      <dd>{primaryAttribution.model}</dd>
                    </div>
                    <div>
                      <dt className="text-text-secondary">Motivo</dt>
                      <dd>{primaryAttribution.attribution_reason ?? "—"}</dd>
                    </div>
                  </>
                ) : null}
                {!hasShopifySignals ? (
                  <div className="sm:col-span-2 rounded-md border border-border bg-muted/40 px-3 py-2 text-text-secondary">
                    Sin atribución (sin UTM ni click IDs en el pedido Shopify).
                  </div>
                ) : null}
              </dl>
              ),
          },
          {
            value: "logistica",
            label: "Logística",
            content: detail.shipments.length ? (
              <DataTable
                data={detail.shipments}
                getRowId={(row) => row.id}
                columns={[
                  { id: "trk", header: "Tracking", cell: (row) => row.tracking_number ?? "—" },
                  { id: "status", header: "Estado", cell: (row) => row.status },
                  { id: "rto", header: "RTO", cell: (row) => (row.is_rto ? "Sí" : "No") },
                ]}
              />
            ) : (
              <EmptyState title="Sin envíos" description="Aún no hay logística vinculada." />
            ),
          },
          {
            value: "confirmacion",
            label: "Confirmación",
            content: (
              <div className="space-y-2 text-sm">
                <p>
                  Estado: <ConfirmationStatusBadge status={order.confirmation_status} />
                </p>
                <p>Confirmado en: {order.confirmed_at ? formatWhen(order.confirmed_at) : "—"}</p>
                <p>Conversaciones WhatsApp: {detail.whatsappConversations.length}</p>
                <p>Mensajes: {detail.whatsappMessages.length}</p>
              </div>
            ),
          },
          {
            value: "conciliacion",
            label: "Conciliación",
            content: detail.settlementItems.length ? (
              <DataTable
                data={detail.settlementItems}
                getRowId={(row) => row.id}
                columns={[
                  { id: "expected", header: "Esperado", cell: (row) => row.expected_amount },
                  { id: "settled", header: "Liquidado", cell: (row) => row.settled_amount },
                  { id: "status", header: "Estado", cell: (row) => row.status },
                ]}
              />
            ) : (
              <EmptyState title="Sin liquidaciones" description="No hay ítems de conciliación." />
            ),
          },
          {
            value: "eventos",
            label: pendingConversions
              ? `Eventos (${pendingConversions} en revisión)`
              : "Eventos",
            content: (
              <div className="space-y-5">
                <section className="space-y-2">
                  <div>
                    <h3 className="text-sm font-semibold">Conversión (Meta / TikTok)</h3>
                    <p className="text-xs text-text-secondary">
                      Si se avisó a la plataforma de anuncios: enviado, falló o prueba · última vez.
                    </p>
                  </div>
                  <ConversionReleasePanel
                    agencySlug={p.agencySlug}
                    storeSlug={p.storeSlug}
                    events={conversionItems}
                    canManage={canManage}
                    timeZone={storeTimeZone}
                  />
                </section>
                <section className="space-y-2">
                  <h3 className="text-sm font-semibold">Historial</h3>
                  <ul className="space-y-3">
                    {detail.timeline.map((item) => (
                      <li key={item.id} className="rounded-md border border-border px-3 py-2 text-sm">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="font-medium">{item.title}</span>
                          <time className="text-xs text-text-secondary">
                            {formatWhen(item.occurredAt)}
                          </time>
                        </div>
                        {item.description ? <p className="mt-1 text-text-secondary">{item.description}</p> : null}
                        <p className="mt-1 text-[11px] uppercase tracking-wide text-text-secondary">{item.kind}</p>
                      </li>
                    ))}
                  </ul>
                </section>
              </div>
            ),
          },
          {
            value: "auditoria",
            label: "Auditoría",
            content: detail.auditLogs.length ? (
              <DataTable
                data={detail.auditLogs}
                getRowId={(row) => String(row.id)}
                columns={[
                  { id: "action", header: "Acción", cell: (row) => row.action },
                  {
                    id: "when",
                    header: "Cuándo",
                    cell: (row) => formatWhen(row.created_at),
                  },
                  {
                    id: "actor",
                    header: "Actor",
                    cell: (row) => row.actor_id?.slice(0, 8) ?? "—",
                  },
                ]}
              />
            ) : (
              <EmptyState title="Sin auditoría" description="Aún no hay eventos auditados para este pedido." />
            ),
          },
        ]}
      />

      {detail.notes.length ? (
        <div className="space-y-2">
          <h3 className="text-sm font-semibold">Notas internas</h3>
          <ul className="space-y-2">
            {detail.notes.map((note) => (
              <li key={note.id} className="rounded-md border border-border px-3 py-2 text-sm">
                <p>{note.body}</p>
                <p className="mt-1 text-xs text-text-secondary">
                  {formatWhen(note.created_at)}
                </p>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}
