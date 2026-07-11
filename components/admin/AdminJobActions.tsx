"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  cancelJobAction,
  ignoreDeadLetterAction,
  ignoreRawEventAction,
  processJobsBatchAction,
  retryDeadLetterAction,
  retryJobAction,
  retryRawEventAction,
} from "@/app/actions/admin-jobs";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";

type ActionFn = () => Promise<{ error?: string; claimed?: number; completed?: number; retried?: number; deadLetter?: number }>;

function useAdminAction() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  function run(action: ActionFn, successMessage?: string) {
    setError(null);
    setMessage(null);
    startTransition(() => {
      void (async () => {
        const result = await action();
        if (result.error) {
          setError(result.error);
          return;
        }
        if (successMessage) setMessage(successMessage);
        if (result.claimed != null) {
          setMessage(
            `Lote: ${result.claimed} reclamados, ${result.completed ?? 0} ok, ${result.retried ?? 0} reintento, ${result.deadLetter ?? 0} cola errores.`,
          );
        }
        router.refresh();
      })();
    });
  }

  return { pending, error, message, run };
}

export function JobActionsPanel({
  jobId,
  status,
  showProcessBatch = false,
}: {
  jobId?: string;
  status?: string;
  showProcessBatch?: boolean;
}) {
  const { pending, error, message, run } = useAdminAction();
  const canRetry = status ? ["failed", "dead_letter", "cancelled", "retry_scheduled"].includes(status) : false;
  const canCancel = status ? ["queued", "retry_scheduled", "processing"].includes(status) : false;

  return (
    <div className="space-y-3 rounded-lg border border-border bg-surface-elevated p-4">
      <h2 className="text-sm font-semibold">Acciones</h2>
      {error ? (
        <Alert variant="danger" title="Error">
          {error}
        </Alert>
      ) : null}
      {message ? (
        <Alert variant="success" title="Listo">
          {message}
        </Alert>
      ) : null}
      <div className="flex flex-wrap gap-2">
        {jobId && canRetry ? (
          <Button size="sm" disabled={pending} onClick={() => run(() => retryJobAction(jobId), "Trabajo reencolado.")}>
            Reintentar
          </Button>
        ) : null}
        {jobId && canCancel ? (
          <Button
            size="sm"
            variant="outline"
            disabled={pending}
            onClick={() => run(() => cancelJobAction(jobId), "Trabajo cancelado.")}
          >
            Cancelar
          </Button>
        ) : null}
        {showProcessBatch ? (
          <Button
            size="sm"
            variant="secondary"
            disabled={pending}
            onClick={() => run(() => processJobsBatchAction(10))}
          >
            Procesar lote (10)
          </Button>
        ) : null}
      </div>
    </div>
  );
}

export function WebhookActionsPanel({ eventId, status }: { eventId: string; status: string }) {
  const { pending, error, message, run } = useAdminAction();
  const canRetry = ["failed", "dead_letter", "ignored", "retrying"].includes(status);
  const canIgnore = status !== "ignored" && status !== "processed";

  return (
    <div className="space-y-3 rounded-lg border border-border bg-surface-elevated p-4">
      <h2 className="text-sm font-semibold">Acciones</h2>
      {error ? (
        <Alert variant="danger" title="Error">
          {error}
        </Alert>
      ) : null}
      {message ? (
        <Alert variant="success" title="Listo">
          {message}
        </Alert>
      ) : null}
      <div className="flex flex-wrap gap-2">
        {canRetry ? (
          <Button
            size="sm"
            disabled={pending}
            onClick={() => run(() => retryRawEventAction(eventId), "Evento reencolado.")}
          >
            Reintentar
          </Button>
        ) : null}
        {canIgnore ? (
          <Button
            size="sm"
            variant="outline"
            disabled={pending}
            onClick={() => run(() => ignoreRawEventAction(eventId), "Evento ignorado.")}
          >
            Ignorar
          </Button>
        ) : null}
      </div>
    </div>
  );
}

export function DeadLetterActionsPanel({
  id,
  kind,
}: {
  id: string;
  kind: "job" | "event";
}) {
  const { pending, error, message, run } = useAdminAction();
  return (
    <div className="space-y-3 rounded-lg border border-border bg-surface-elevated p-4">
      <h2 className="text-sm font-semibold">Acciones</h2>
      {error ? (
        <Alert variant="danger" title="Error">
          {error}
        </Alert>
      ) : null}
      {message ? (
        <Alert variant="success" title="Listo">
          {message}
        </Alert>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <Button
          size="sm"
          disabled={pending}
          onClick={() => run(() => retryDeadLetterAction(id, kind), "Reencolado desde cola de errores.")}
        >
          Reintentar
        </Button>
        <Button
          size="sm"
          variant="outline"
          disabled={pending}
          onClick={() => run(() => ignoreDeadLetterAction(id, kind), "Marcado como ignorado.")}
        >
          Marcar ignorado
        </Button>
      </div>
    </div>
  );
}
