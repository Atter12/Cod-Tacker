import Link from "next/link";
import { CollapsibleJson } from "@/components/admin/CollapsibleJson";
import {
  isLogisticsEventStale,
  LogisticsLatencyNotice,
} from "@/components/logistics/LogisticsLatencyNotice";
import { ShipmentActionsPanel } from "@/components/logistics/ShipmentActionsPanel";
import {
  DataTable,
  EmptyState,
  ErrorState,
  SectionHeader,
  StatusBadge,
  Tabs,
} from "@/components/ui";
import { routes } from "@/config/routes";
import { labelShipmentStatus } from "@/lib/logistics/labels";
import { can } from "@/lib/permissions/can";
import { createClient } from "@/lib/supabase/server";
import { requireStoreAccess } from "@/lib/tenant/require-store-access";
import { getShipmentDetail } from "@/services/shipments.service";

function formatDate(value: string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("es-PE", { dateStyle: "medium", timeStyle: "short" }).format(
    new Date(value),
  );
}

export default async function ShipmentDetailPage({
  params,
}: {
  params: Promise<{ agencySlug: string; storeSlug: string; shipmentId: string }>;
}) {
  const p = await params;
  const member = await requireStoreAccess(p.agencySlug, p.storeSlug);
  if (!can(member.roles, "shipments.view") && !can(member.roles, "orders.view")) {
    return <ErrorState title="Sin permiso" description="No puedes ver este envío." />;
  }
  if (!member.storeId) {
    return <ErrorState title="Tienda inválida" description="No se pudo resolver la tienda activa." />;
  }

  const detail = await getShipmentDetail(await createClient(), member.storeId, p.shipmentId);
  if (!detail) {
    return <ErrorState title="Envío no encontrado" description="El identificador no existe en esta tienda." />;
  }

  const { shipment, events, order, customer, rawEvents, jobs } = detail;
  const canManage = can(member.roles, "shipments.manage") || can(member.roles, "orders.manage");
  const needsReview =
    shipment.metadata &&
    typeof shipment.metadata === "object" &&
    !Array.isArray(shipment.metadata) &&
    Boolean((shipment.metadata as Record<string, unknown>).needs_review);
  const eventStale =
    isLogisticsEventStale(shipment.last_event_at) || events.length === 0;

  return (
    <section className="space-y-5">
      <SectionHeader
        title={shipment.tracking_number ?? "Envío"}
        description={`${labelShipmentStatus(shipment.status)}${shipment.is_rto ? " · RTO" : ""}${needsReview ? " · Revisión" : ""}`}
        action={
          <Link
            className="text-sm text-brand-primary hover:underline"
            href={routes.store.logistics(p.agencySlug, p.storeSlug)}
          >
            ← Volver a logística
          </Link>
        }
      />

      {eventStale ? (
        <LogisticsLatencyNotice mode="empty" />
      ) : (
        <LogisticsLatencyNotice mode="general" />
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-3 rounded-lg border border-border bg-surface-elevated p-4 text-sm lg:col-span-2">
          <dl className="grid gap-2 sm:grid-cols-2">
            <div>
              <dt className="text-text-secondary">Estado</dt>
              <dd>
                <StatusBadge status={shipment.status} label={labelShipmentStatus(shipment.status)} />
              </dd>
            </div>
            <div>
              <dt className="text-text-secondary">Intentos de entrega</dt>
              <dd>{shipment.delivery_attempts}</dd>
            </div>
            <div>
              <dt className="text-text-secondary">Último evento</dt>
              <dd>{formatDate(shipment.last_event_at)}</dd>
            </div>
            <div>
              <dt className="text-text-secondary">Terminal / RTO</dt>
              <dd>
                {shipment.is_terminal ? "Terminal" : "En curso"}
                {shipment.is_rto ? " · RTO" : ""}
              </dd>
            </div>
            <div>
              <dt className="text-text-secondary">Pedido</dt>
              <dd>
                <Link
                  className="text-brand-primary hover:underline"
                  href={routes.store.orderDetail(p.agencySlug, p.storeSlug, shipment.order_id)}
                >
                  {order?.order_number ?? order?.external_order_id ?? shipment.order_id.slice(0, 8)}
                </Link>
              </dd>
            </div>
            <div>
              <dt className="text-text-secondary">Cliente</dt>
              <dd>
                {customer
                  ? [customer.first_name, customer.last_name].filter(Boolean).join(" ") ||
                    customer.phone ||
                    "—"
                  : "—"}
              </dd>
            </div>
            <div>
              <dt className="text-text-secondary">Destino</dt>
              <dd>
                {[shipment.destination_district, shipment.destination_city, shipment.destination_region]
                  .filter(Boolean)
                  .join(", ") || "—"}
              </dd>
            </div>
            <div>
              <dt className="text-text-secondary">Entregado / Devuelto</dt>
              <dd>
                {formatDate(shipment.delivered_at)} / {formatDate(shipment.returned_at)}
              </dd>
            </div>
          </dl>
        </div>
        <ShipmentActionsPanel
          agencySlug={p.agencySlug}
          storeSlug={p.storeSlug}
          shipmentId={shipment.id}
          canManage={canManage}
        />
      </div>

      <Tabs
        defaultValue="timeline"
        tabs={[
          {
            value: "timeline",
            label: `Línea de tiempo (${events.length})`,
            content:
              events.length === 0 ? (
                <EmptyState title="Sin eventos" description="Todavía no hay eventos de tracking." />
              ) : (
                <div className="overflow-hidden rounded-lg border border-border">
                  <DataTable
                    data={events}
                    getRowId={(row) => row.id}
                    columns={[
                      {
                        id: "when",
                        header: "Ocurrió",
                        cell: (row) => formatDate(row.occurred_at),
                      },
                      {
                        id: "status",
                        header: "Estado",
                        cell: (row) => (
                          <StatusBadge
                            status={row.normalized_status}
                            label={labelShipmentStatus(row.normalized_status)}
                          />
                        ),
                      },
                      {
                        id: "external",
                        header: "Externo",
                        cell: (row) =>
                          row.external_status_label ?? row.external_status_code ?? "—",
                      },
                      {
                        id: "location",
                        header: "Ubicación",
                        cell: (row) => row.location_text ?? "—",
                      },
                    ]}
                  />
                </div>
              ),
          },
          {
            value: "correlation",
            label: "Correlación",
            content: (
              <div className="space-y-4">
                <div>
                  <h3 className="mb-2 text-sm font-medium">Eventos crudos</h3>
                  {rawEvents.length === 0 ? (
                    <p className="text-sm text-text-secondary">Sin raw_events vinculados.</p>
                  ) : (
                    <ul className="space-y-1 text-sm">
                      {rawEvents.map((e) => (
                        <li key={e.id} className="font-mono text-xs">
                          {e.event_type} · {e.status} · {e.id}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                <div>
                  <h3 className="mb-2 text-sm font-medium">Trabajos</h3>
                  {jobs.length === 0 ? (
                    <p className="text-sm text-text-secondary">Sin background_jobs vinculados.</p>
                  ) : (
                    <ul className="space-y-1 text-sm">
                      {jobs.map((j) => (
                        <li key={j.id} className="font-mono text-xs">
                          {j.job_type} · {j.status} · {j.id}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            ),
          },
          {
            value: "meta",
            label: "Metadata",
            content: <CollapsibleJson value={shipment.metadata} title="Metadata del envío" defaultOpen />,
          },
        ]}
      />
    </section>
  );
}
