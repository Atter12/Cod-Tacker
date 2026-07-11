"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  acknowledgeAlert,
  addAlertNote,
  assignAlert,
  reopenAlert,
  resolveAlert,
  silenceAlert,
} from "@/app/actions/alerts";
import { Button, Textarea } from "@/components/ui";

export function AlertActionsPanel({
  agencySlug,
  storeSlug,
  alertId,
  status,
  canManage,
  currentUserId,
}: {
  agencySlug: string;
  storeSlug: string;
  alertId: string;
  status: string;
  canManage: boolean;
  currentUserId: string;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);

  if (!canManage) return null;

  function run(fn: () => Promise<{ error?: string }>) {
    setError(null);
    start(async () => {
      const r = await fn();
      if (r.error) setError(r.error);
      else router.refresh();
    });
  }

  return (
    <div className="space-y-3 rounded-lg border border-border p-4">
      <h3 className="text-sm font-semibold">Acciones</h3>
      {error && <p className="text-sm text-danger">{error}</p>}
      <div className="flex flex-wrap gap-2">
        {status === "open" || status === "reopened" ? (
          <Button size="sm" disabled={pending} onClick={() => run(() => acknowledgeAlert(agencySlug, storeSlug, alertId))}>
            Reconocer
          </Button>
        ) : null}
        {status !== "resolved" ? (
          <Button size="sm" disabled={pending} onClick={() => run(() => resolveAlert(agencySlug, storeSlug, alertId))}>
            Resolver
          </Button>
        ) : (
          <Button size="sm" variant="secondary" disabled={pending} onClick={() => run(() => reopenAlert(agencySlug, storeSlug, alertId))}>
            Reabrir
          </Button>
        )}
        <Button size="sm" variant="secondary" disabled={pending} onClick={() => run(() => silenceAlert(agencySlug, storeSlug, alertId, 24))}>
          Silenciar 24h
        </Button>
        <Button
          size="sm"
          variant="outline"
          disabled={pending}
          onClick={() => run(() => assignAlert(agencySlug, storeSlug, alertId, currentUserId))}
        >
          Asignarme
        </Button>
      </div>
      <div className="space-y-2 border-t border-border pt-3">
        <Textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Añadir nota…" rows={3} />
        <Button
          size="sm"
          variant="secondary"
          disabled={pending || !note.trim()}
          onClick={() =>
            run(async () => {
              const r = await addAlertNote(agencySlug, storeSlug, alertId, note);
              if (!r.error) setNote("");
              return r;
            })
          }
        >
          Guardar nota
        </Button>
      </div>
    </div>
  );
}

export function BulkResolveButton({
  agencySlug,
  storeSlug,
  selectedIds,
}: {
  agencySlug: string;
  storeSlug: string;
  selectedIds: string[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  if (!selectedIds.length) return null;
  return (
    <Button
      size="sm"
      disabled={pending}
      onClick={() =>
        start(async () => {
          const { bulkResolveAlerts } = await import("@/app/actions/alerts");
          const r = await bulkResolveAlerts(agencySlug, storeSlug, selectedIds);
          if (r.error) alert(r.error);
          else router.refresh();
        })
      }
    >
      Resolver seleccionadas ({selectedIds.length})
    </Button>
  );
}
