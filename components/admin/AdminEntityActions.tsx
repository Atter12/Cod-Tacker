"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  grantSupportAccessNote,
  setAgencyActive,
  setStoreActive,
  setUserActive,
} from "@/app/actions/admin-entities";
import { Button, FormField, Textarea } from "@/components/ui";

export function AdminEntityActions({
  kind,
  entityId,
  isActive,
  agencyIdForSupport,
}: {
  kind: "agency" | "store" | "user";
  entityId: string;
  isActive: boolean;
  agencyIdForSupport?: string;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [reason, setReason] = useState("");

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
      <h3 className="text-sm font-semibold">Acciones de plataforma</h3>
      {error ? <p className="text-sm text-danger">{error}</p> : null}
      <div className="flex flex-wrap gap-2">
        {isActive ? (
          <Button
            size="sm"
            variant="danger"
            disabled={pending}
            onClick={() => {
              if (!confirm("¿Suspender esta entidad? Dejará de ser accesible según política.")) return;
              if (kind === "agency") run(() => setAgencyActive(entityId, false));
              else if (kind === "store") run(() => setStoreActive(entityId, false));
              else run(() => setUserActive(entityId, false));
            }}
          >
            Suspender
          </Button>
        ) : (
          <Button
            size="sm"
            disabled={pending}
            onClick={() => {
              if (kind === "agency") run(() => setAgencyActive(entityId, true));
              else if (kind === "store") run(() => setStoreActive(entityId, true));
              else run(() => setUserActive(entityId, true));
            }}
          >
            Reactivar
          </Button>
        )}
      </div>
      {kind === "agency" && agencyIdForSupport ? (
        <div className="space-y-2 border-t border-border pt-3">
          <p className="text-xs text-text-secondary">
            Acceso de soporte auditado (sin impersonación). Se registra en auditoría.
          </p>
          <FormField label="Motivo" htmlFor="support-reason">
            <Textarea
              id="support-reason"
              rows={2}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Ticket / motivo de soporte…"
            />
          </FormField>
          <Button
            size="sm"
            variant="outline"
            disabled={pending || reason.trim().length < 8}
            onClick={() => run(() => grantSupportAccessNote(agencyIdForSupport, reason))}
          >
            Registrar acceso de soporte
          </Button>
        </div>
      ) : null}
    </div>
  );
}
