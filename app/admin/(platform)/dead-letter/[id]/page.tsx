import Link from "next/link";
import { DeadLetterActionsPanel } from "@/components/admin/AdminJobActions";
import { CollapsibleJson } from "@/components/admin/CollapsibleJson";
import { ErrorState, PageHeader, StatusBadge } from "@/components/ui";
import { routes } from "@/config/routes";
import { parseEnumParam, type SearchParamsRecord } from "@/lib/http/search-params";
import { labelEventStatus, labelJobStatus } from "@/lib/logistics/labels";
import { createClient } from "@/lib/supabase/server";
import { getJob, getRawEvent } from "@/services/jobs.service";

const KIND_VALUES = ["job", "event"] as const;

function formatDate(value: string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("es-PE", { dateStyle: "medium", timeStyle: "short" }).format(
    new Date(value),
  );
}

export default async function AdminDeadLetterDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<SearchParamsRecord>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  let kind = parseEnumParam(sp, "kind", KIND_VALUES);
  const client = await createClient();

  let job = kind === "event" ? null : await getJob(client, id);
  let event = kind === "job" ? null : await getRawEvent(client, id);

  if (!kind) {
    if (job?.status === "dead_letter") kind = "job";
    else if (event?.status === "dead_letter") kind = "event";
    else if (job) kind = "job";
    else if (event) kind = "event";
  }

  if (kind === "job") event = null;
  if (kind === "event") job = null;

  if (!job && !event) {
    return (
      <div className="space-y-6">
        <PageHeader title="Cola de errores" description={id} />
        <ErrorState title="Elemento no encontrado" description="No existe un trabajo ni evento con este id." />
      </div>
    );
  }

  if (job) {
    return (
      <div className="space-y-6">
        <PageHeader
          title={job.job_type}
          description="Trabajo en cola de errores"
          actions={
            <Link className="text-sm text-brand-primary hover:underline" href={routes.admin.deadLetter}>
              ← Volver
            </Link>
          }
        />
        <div className="grid gap-4 lg:grid-cols-3">
          <div className="space-y-2 rounded-lg border border-border bg-surface-elevated p-4 text-sm lg:col-span-2">
            <p>
              <StatusBadge status={job.status} label={labelJobStatus(job.status)} />
            </p>
            <p className="text-text-secondary">Creado: {formatDate(job.created_at)}</p>
            <p className="text-danger">
              {job.last_error_code ? `${job.last_error_code}: ` : ""}
              {job.last_error_message ?? "—"}
            </p>
            <p>
              <Link className="text-brand-primary hover:underline" href={routes.admin.jobDetail(job.id)}>
                Ver detalle completo del trabajo
              </Link>
            </p>
            {job.raw_event_id ? (
              <p>
                <Link
                  className="text-brand-primary hover:underline"
                  href={routes.admin.webhookDetail(job.raw_event_id)}
                >
                  Ver evento crudo
                </Link>
              </p>
            ) : null}
          </div>
          <DeadLetterActionsPanel id={job.id} kind="job" />
        </div>
        <CollapsibleJson value={job.payload} title="Payload sanitizado" defaultOpen />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={event!.event_type}
        description={`Evento ${event!.provider} en cola de errores`}
        actions={
          <Link className="text-sm text-brand-primary hover:underline" href={routes.admin.deadLetter}>
            ← Volver
          </Link>
        }
      />
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-2 rounded-lg border border-border bg-surface-elevated p-4 text-sm lg:col-span-2">
          <p>
            <StatusBadge status={event!.status} label={labelEventStatus(event!.status)} />
          </p>
          <p className="text-text-secondary">Recibido: {formatDate(event!.received_at)}</p>
          <p className="text-danger">
            {event!.error_code ? `${event!.error_code}: ` : ""}
            {event!.last_error ?? "—"}
          </p>
          <p>
            <Link className="text-brand-primary hover:underline" href={routes.admin.webhookDetail(event!.id)}>
              Ver detalle completo del evento
            </Link>
          </p>
        </div>
        <DeadLetterActionsPanel id={event!.id} kind="event" />
      </div>
      <CollapsibleJson value={event!.payload} title="Payload sanitizado" defaultOpen />
    </div>
  );
}
