"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { connectEcartPay, syncEcartPaySettlements } from "@/app/actions/reconciliation";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { FormField, Input } from "@/components/ui";

type Props = {
  agencySlug: string;
  storeSlug: string;
  connected: boolean;
  canManage: boolean;
};

/**
 * Conciliación auto: Ecart Pay (COD liquidado vía producto COD de Envia).
 * No sustituye CSV manual del courier.
 */
export function EcartPayPanel({ agencySlug, storeSlug, connected, canManage }: Props) {
  const router = useRouter();
  const [apiToken, setApiToken] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [pending, start] = useTransition();

  if (!canManage) return null;

  return (
    <div className="space-y-3 rounded-lg border border-border bg-surface-elevated p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-sm font-semibold">Ecart Pay (auto)</h2>
        <span className="text-[11px] text-text-secondary">
          {connected ? "Conectado" : "No conectado"}
        </span>
      </div>
      <p className="text-[12.5px] text-text-secondary">
        Solo aplica si el COD se cobra con el servicio COD de Envia → depósitos en Ecart Pay.
        Si el courier te liquida aparte, usa Importar CSV.
      </p>
      <FormField label="API token Ecart Pay" htmlFor="ecart-token">
        <Input
          id="ecart-token"
          type="password"
          autoComplete="off"
          placeholder={connected ? "(pegar nuevo token para rotar)" : "Bearer token"}
          value={apiToken}
          onChange={(e) => setApiToken(e.target.value)}
          disabled={pending}
        />
      </FormField>
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          disabled={pending || !apiToken.trim()}
          onClick={() => {
            setError(null);
            setSuccess(null);
            start(async () => {
              const r = await connectEcartPay(agencySlug, storeSlug, { apiToken });
              if (r.error) {
                setError(r.error);
                return;
              }
              setSuccess(connected ? "Token Ecart Pay actualizado." : "Ecart Pay conectado.");
              setApiToken("");
              router.refresh();
            });
          }}
        >
          {connected ? "Actualizar token" : "Conectar Ecart Pay"}
        </Button>
        <Button
          type="button"
          variant="secondary"
          disabled={pending || !connected}
          onClick={() => {
            setError(null);
            setSuccess(null);
            start(async () => {
              const r = await syncEcartPaySettlements(agencySlug, storeSlug, { days: 30 });
              if (r.error) {
                setError(r.error);
                return;
              }
              setSuccess(`Sync encolado${r.jobId ? ` (job ${r.jobId.slice(0, 8)}…)` : ""}.`);
              router.refresh();
            });
          }}
        >
          Sincronizar liquidaciones (30d)
        </Button>
      </div>
      {error ? <Alert variant="danger">{error}</Alert> : null}
      {success ? <Alert variant="success">{success}</Alert> : null}
    </div>
  );
}
