import Link from "next/link";
import { AlertActionsPanel } from "@/components/alerts/AlertActionsPanel";
import { CollapsibleJson } from "@/components/admin/CollapsibleJson";
import {
  DataTable,
  ErrorState,
  SectionHeader,
  StatusBadge,
} from "@/components/ui";
import { routes } from "@/config/routes";
import { labelAlertSeverity, labelAlertStatus } from "@/lib/alerts/labels";
import { requireUser } from "@/lib/auth/require-user";
import { can } from "@/lib/permissions/can";
import { createClient } from "@/lib/supabase/server";
import { requireStoreAccess } from "@/lib/tenant/require-store-access";
import { getAlertById, listAlertNotes } from "@/services/alerts.service";

export default async function AlertDetailPage({
  params,
}: {
  params: Promise<{ agencySlug: string; storeSlug: string; alertId: string }>;
}) {
  const p = await params;
  const user = await requireUser();
  const member = await requireStoreAccess(p.agencySlug, p.storeSlug);
  if (!can(member.roles, "alerts.view") || !member.storeId) {
    return <ErrorState title="Sin permiso" description="No puedes ver esta alerta." />;
  }

  const client = await createClient();
  const alert = await getAlertById(client, member.storeId, p.alertId);
  if (!alert) {
    return <ErrorState title="No encontrada" description="La alerta no existe en esta tienda." />;
  }
  const notes = await listAlertNotes(client, alert.id);
  const canManage = can(member.roles, "alerts.manage");

  return (
    <section className="space-y-5">
      <SectionHeader
        title={alert.title}
        description={`${labelAlertSeverity(alert.severity)} · ${labelAlertStatus(alert.status)}`}
        action={
          <Link
            className="text-sm underline text-brand-primary"
            href={routes.store.alerts(p.agencySlug, p.storeSlug)}
          >
            Volver
          </Link>
        }
      />
      <div className="flex flex-wrap gap-2">
        <StatusBadge status={alert.severity} label={labelAlertSeverity(alert.severity)} />
        <StatusBadge status={alert.status} label={labelAlertStatus(alert.status)} />
        <span className="text-sm text-text-secondary">{alert.type}</span>
      </div>
      {alert.body && <p className="text-sm">{alert.body}</p>}

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="space-y-3">
          <h3 className="text-sm font-semibold">Relacionados</h3>
          <ul className="text-sm space-y-1">
            {alert.order_id && (
              <li>
                Pedido:{" "}
                <Link
                  className="underline text-brand-primary"
                  href={routes.store.orderDetail(p.agencySlug, p.storeSlug, alert.order_id)}
                >
                  {alert.order_id.slice(0, 8)}
                </Link>
              </li>
            )}
            {alert.shipment_id && (
              <li>
                Envío:{" "}
                <Link
                  className="underline text-brand-primary"
                  href={routes.store.shipmentDetail(p.agencySlug, p.storeSlug, alert.shipment_id)}
                >
                  {alert.shipment_id.slice(0, 8)}
                </Link>
              </li>
            )}
            {alert.campaign_id && (
              <li>
                Campaña:{" "}
                <Link
                  className="underline text-brand-primary"
                  href={routes.store.campaignDetail(p.agencySlug, p.storeSlug, alert.campaign_id)}
                >
                  {alert.campaign_id.slice(0, 8)}
                </Link>
              </li>
            )}
            {!alert.order_id && !alert.shipment_id && !alert.campaign_id && <li>—</li>}
          </ul>
          <h3 className="text-sm font-semibold">Evidencia (sanitizada)</h3>
          <CollapsibleJson value={alert.data} />
        </div>
        <AlertActionsPanel
          agencySlug={p.agencySlug}
          storeSlug={p.storeSlug}
          alertId={alert.id}
          status={alert.status}
          canManage={canManage}
          currentUserId={user.id}
        />
      </div>

      <h3 className="text-sm font-semibold">Timeline / notas</h3>
      <DataTable
        data={notes}
        getRowId={(n) => n.id}
        columns={[
          {
            id: "at",
            header: "Fecha",
            cell: (n) => new Date(n.created_at).toLocaleString("es-PE"),
          },
          { id: "body", header: "Nota", cell: (n) => n.body },
        ]}
        emptyMessage="Sin notas aún."
      />
    </section>
  );
}
