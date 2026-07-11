import Link from "next/link";
import { JobActionsPanel } from "@/components/admin/AdminJobActions";
import { CollapsibleJson } from "@/components/admin/CollapsibleJson";
import {
  DataTable,
  EmptyState,
  ErrorState,
  PageHeader,
  StatusBadge,
  Tabs,
} from "@/components/ui";
import { routes } from "@/config/routes";
import { labelJobStatus } from "@/lib/logistics/labels";
import { createClient } from "@/lib/supabase/server";
import { getJob, getRawEvent, listJobAttempts } from "@/services/jobs.service";

function formatDate(value: string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("es-PE", { dateStyle: "medium", timeStyle: "short" }).format(
    new Date(value),
  );
}

export default async function AdminJobDetailPage({
  params,
}: {
  params: Promise<{ jobId: string }>;
}) {
  const { jobId } = await params;
  const client = await createClient();
  const job = await getJob(client, jobId);
  if (!job) {
    return (
      <div className="space-y-6">
        <PageHeader title="Trabajo" description={jobId} />
        <ErrorState title="Trabajo no encontrado" description="El identificador no existe o no tienes acceso." />
      </div>
    );
  }

  const [attempts, rawEvent] = await Promise.all([
    listJobAttempts(client, job.id),
    job.raw_event_id ? getRawEvent(client, job.raw_event_id) : Promise.resolve(null),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title={job.job_type}
        description={`Cola ${job.queue} · ${labelJobStatus(job.status)}`}
        actions={
          <Link className="text-sm text-brand-primary hover:underline" href={routes.admin.jobs}>
            ← Volver a tareas
          </Link>
        }
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-3 rounded-lg border border-border bg-surface-elevated p-4 text-sm lg:col-span-2">
          <dl className="grid gap-2 sm:grid-cols-2">
            <div>
              <dt className="text-text-secondary">Estado</dt>
              <dd>
                <StatusBadge status={job.status} label={labelJobStatus(job.status)} />
              </dd>
            </div>
            <div>
              <dt className="text-text-secondary">Intentos</dt>
              <dd>
                {job.attempts}/{job.max_attempts}
              </dd>
            </div>
            <div>
              <dt className="text-text-secondary">Próximo reintento</dt>
              <dd>{formatDate(job.run_at)}</dd>
            </div>
            <div>
              <dt className="text-text-secondary">Correlación</dt>
              <dd className="font-mono text-xs">{job.correlation_id ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-text-secondary">Idempotencia</dt>
              <dd className="font-mono text-xs break-all">{job.idempotency_key}</dd>
            </div>
            <div>
              <dt className="text-text-secondary">Evento crudo</dt>
              <dd>
                {job.raw_event_id ? (
                  <Link
                    className="text-brand-primary hover:underline"
                    href={routes.admin.webhookDetail(job.raw_event_id)}
                  >
                    Ver evento
                  </Link>
                ) : (
                  "—"
                )}
              </dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="text-text-secondary">Último error</dt>
              <dd className="text-danger">
                {job.last_error_code ? `${job.last_error_code}: ` : ""}
                {job.last_error_message ?? "—"}
              </dd>
            </div>
          </dl>
        </div>
        <JobActionsPanel jobId={job.id} status={job.status} showProcessBatch />
      </div>

      <Tabs
        defaultValue="payload"
        tabs={[
          {
            value: "payload",
            label: "Payload",
            content: <CollapsibleJson value={job.payload} title="Payload sanitizado" defaultOpen />,
          },
          {
            value: "attempts",
            label: `Intentos (${attempts.total})`,
            content:
              attempts.data.length === 0 ? (
                <EmptyState title="Sin intentos" description="Este trabajo aún no tiene registros de intento." />
              ) : (
                <div className="overflow-hidden rounded-lg border border-border">
                  <DataTable
                    data={attempts.data}
                    getRowId={(row) => row.id}
                    columns={[
                      { id: "n", header: "#", cell: (row) => row.attempt_number },
                      {
                        id: "status",
                        header: "Estado",
                        cell: (row) => <StatusBadge status={row.status} />,
                      },
                      { id: "started", header: "Inicio", cell: (row) => formatDate(row.started_at) },
                      {
                        id: "duration",
                        header: "Duración",
                        cell: (row) => (row.duration_ms != null ? `${row.duration_ms} ms` : "—"),
                      },
                      {
                        id: "error",
                        header: "Error",
                        cell: (row) => row.error_message ?? "—",
                      },
                    ]}
                  />
                </div>
              ),
          },
          {
            value: "raw",
            label: "Evento vinculado",
            content: rawEvent ? (
              <div className="space-y-3">
                <p className="text-sm text-text-secondary">
                  {rawEvent.provider} · {rawEvent.event_type} ·{" "}
                  <Link className="text-brand-primary hover:underline" href={routes.admin.webhookDetail(rawEvent.id)}>
                    abrir detalle
                  </Link>
                </p>
                <CollapsibleJson value={rawEvent.payload} title="Payload del evento" />
              </div>
            ) : (
              <EmptyState title="Sin evento" description="Este trabajo no está vinculado a un raw_event." />
            ),
          },
        ]}
      />
    </div>
  );
}
