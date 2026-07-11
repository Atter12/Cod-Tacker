"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  backfillIntegrationAction,
  connectIntegrationAction,
  disconnectIntegrationAction,
  reconnectIntegrationAction,
  syncIntegrationAction,
  testIntegrationAction,
} from "@/app/actions/integrations";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";

type Props = {
  agencySlug: string;
  storeSlug: string;
  provider: string;
  canManage: boolean;
  connected: boolean;
};

export function IntegrationActions({ agencySlug, storeSlug, provider, canManage, connected }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  if (!canManage) {
    return (
      <Alert variant="info" title="Solo lectura">
        Tu rol puede ver la integración, pero no ejecutar acciones de conexión o sincronización.
      </Alert>
    );
  }

  function run(action: () => Promise<{ error?: string; runId?: string }>, successMessage: string) {
    setError(null);
    setMessage(null);
    startTransition(() => {
      void (async () => {
        const result = await action();
        if (result.error) {
          setError(result.error);
          return;
        }
        setMessage(successMessage);
        router.refresh();
      })();
    });
  }

  return (
    <div className="space-y-3 rounded-lg border border-border bg-surface-elevated p-4">
      <h2 className="text-sm font-semibold">Acciones</h2>
      {error ? (
        <Alert variant="danger" title="No se pudo completar">
          {error}
        </Alert>
      ) : null}
      {message ? (
        <Alert variant="success" title="Listo">
          {message}
        </Alert>
      ) : null}
      <div className="flex flex-wrap gap-2">
        {!connected ? (
          <Button
            size="sm"
            disabled={pending}
            onClick={() =>
              run(() => connectIntegrationAction(agencySlug, storeSlug, provider), "Integración conectada (mock).")
            }
          >
            Conectar mock
          </Button>
        ) : (
          <>
            <Button
              size="sm"
              disabled={pending}
              onClick={() =>
                run(() => testIntegrationAction(agencySlug, storeSlug, provider), "Prueba de conexión registrada.")
              }
            >
              Probar conexión
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={pending}
              onClick={() =>
                run(() => syncIntegrationAction(agencySlug, storeSlug, provider), "Sincronización incremental iniciada.")
              }
            >
              Sincronizar ahora
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={pending}
              onClick={() => {
                if (!window.confirm("¿Ejecutar backfill histórico mock? Puede generar más registros de demostración.")) {
                  return;
                }
                run(
                  () => backfillIntegrationAction(agencySlug, storeSlug, provider),
                  "Backfill histórico iniciado.",
                );
              }}
            >
              Backfill
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={pending}
              onClick={() =>
                run(
                  () => reconnectIntegrationAction(agencySlug, storeSlug, provider),
                  "Integración reconectada (mock).",
                )
              }
            >
              Reconectar
            </Button>
            <Button
              size="sm"
              variant="danger"
              disabled={pending}
              onClick={() => {
                if (!window.confirm("¿Desconectar esta integración?")) return;
                run(
                  () => disconnectIntegrationAction(agencySlug, storeSlug, provider),
                  "Integración desconectada.",
                );
              }}
            >
              Desconectar
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
