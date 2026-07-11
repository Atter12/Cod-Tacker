import Link from "next/link";
import { WebhookActionsPanel } from "@/components/admin/AdminJobActions";
import { CollapsibleJson } from "@/components/admin/CollapsibleJson";
import {
  DataTable,
  EmptyState,
  ErrorState,
  PageHeader,
  StatusBadge,
} from "@/components/ui";
import { routes } from "@/config/routes";
import { labelEventStatus, labelJobStatus } from "@/lib/logistics/labels";
import { createClient } from "@/lib/supabase/server";
import { getRawEvent, listJobsForRawEvent } from "@/services/jobs.service";

function formatDate(value: string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("es-PE", { dateStyle: "medium", timeStyle: "short" }).format(
    new Date(value),
  );
}

export default async function AdminWebhookDetailPage({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  const { eventId } = await params;
  const client = await createClient();
  const event = await getRawEvent(client, eventId);
  if (!event) {
    return (
      <div className="space-y-6">
        <PageHeader title="Evento" description={eventId} />
        <ErrorState title="Evento no encontrado" description="El identificador no existe o no tienes acceso." />
      </div>
    );
  }

  const jobs = await listJobsForRawEvent(client, event.id);

  return (
    <div className="space-y-6">
      <PageHeader
        title={event.event_type}
        description={`${event.provider} · ${labelEventStatus(event.status)}`}
        actions={
          <Link className="text-sm text-brand-primary hover:underline" href={routes.admin.webhooks}>
            ← Volver a webhooks
          </Link>
        }
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-3 rounded-lg border border-border bg-surface-elevated p-4 text-sm lg:col-span-2">
          <dl className="grid gap-2 sm:grid-cols-2">
            <div>
              <dt className="text-text-secondary">Estado</dt>
              <dd>
                <StatusBadge status={event.status} label={labelEventStatus(event.status)} />
              </dd>
            </div>
            <div>
              <dt className="text-text-secondary">Intentos</dt>
              <dd>
                {event.attempts}/{event.max_attempts}
              </dd>
            </div>
            <div>
              <dt className="text-text-secondary">Recibido</dt>
              <dd>{formatDate(event.received_at)}</dd>
            </div>
            <div>
              <dt className="text-text-secondary">Próximo reintento</dt>
              <dd>{formatDate(event.next_retry_at)}</dd>
            </div>
            <div>
              <dt className="text-text-secondary">Correlación</dt>
              <dd className="font-mono text-xs">{event.correlation_id ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-text-secondary">Id externo</dt>
              <dd className="font-mono text-xs break-all">{event.external_event_id ?? "—"}</dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="text-text-secondary">Último error</dt>
              <dd className="text-danger">
                {event.error_code ? `${event.error_code}: ` : ""}
                {event.last_error ?? "—"}
              </dd>
            </div>
          </dl>
        </div>
        <WebhookActionsPanel eventId={event.id} status={event.status} />
      </div>

      <CollapsibleJson value={event.payload} title="Payload sanitizado" defaultOpen />

      <section className="space-y-3">
        <h2 className="text-sm font-semibold">Trabajos correlacionados</h2>
        {jobs.length === 0 ? (
          <EmptyState title="Sin trabajos" description="Todavía no hay background_jobs para este evento." />
        ) : (
          <div className="overflow-hidden rounded-lg border border-border">
            <DataTable
              data={jobs}
              getRowId={(row) => row.id}
              columns={[
                {
                  id: "type",
                  header: "Tipo",
                  cell: (row) => (
                    <Link className="text-brand-primary hover:underline" href={routes.admin.jobDetail(row.id)}>
                      {row.job_type}
                    </Link>
                  ),
                },
                {
                  id: "status",
                  header: "Estado",
                  cell: (row) => <StatusBadge status={row.status} label={labelJobStatus(row.status)} />,
                },
                { id: "created", header: "Creado", cell: (row) => formatDate(row.created_at) },
              ]}
            />
          </div>
        )}
      </section>
    </div>
  );
}
