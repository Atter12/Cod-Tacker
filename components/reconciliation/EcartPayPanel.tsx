"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { connectEcartPay, syncEcartPaySettlements } from "@/app/actions/reconciliation";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { FormField, Input } from "@/components/ui";
import type { EcartSyncOutcome } from "@/lib/integrations/ecart-pay/sync-outcome";

type LastSyncSummary = {
  outcome: EcartSyncOutcome;
  message: string;
  finishedAt: string | null;
  triggerSource: string | null;
  rowCount: number | null;
};

type Props = {
  agencySlug: string;
  storeSlug: string;
  connected: boolean;
  canManage: boolean;
  lastSync?: LastSyncSummary | null;
};

/**
 * Conciliación auto: Ecart Pay (COD liquidado vía producto COD de Envia).
 * Guarda public/private key cifradas; el Bearer (~1h) se renueva en cada sync.
 * Sync periódico (~cada 8h) vía cron; el botón es opcional.
 */
export function EcartPayPanel({
  agencySlug,
  storeSlug,
  connected,
  canManage,
  lastSync = null,
}: Props) {
  const router = useRouter();
  const [publicKey, setPublicKey] = useState("");
  const [privateKey, setPrivateKey] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [pending, start] = useTransition();

  if (!canManage) return null;

  const canConnect = publicKey.trim().length > 0 && privateKey.trim().length > 0;

  return (
    <div className="space-y-3 rounded-lg border border-border bg-surface-elevated p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-sm font-semibold">Ecart Pay (auto)</h2>
        <span className="text-[11px] text-text-secondary">
          {connected ? "Conectado · sync cada ~8h" : "No conectado"}
        </span>
      </div>
      <p className="text-[12.5px] text-text-secondary">
        Solo aplica si el COD se cobra con el servicio COD de Envia → depósitos en Ecart Pay.
        Guarda la <strong>public</strong> y <strong>private key</strong> (no el Bearer de 1 h):
        CODTracked renueva el token al sincronizar. Si el courier te liquida aparte, usa Importar
        CSV.
      </p>
      {connected && lastSync ? (
        <p className="text-[12px] text-text-secondary">
          Último sync ({lastSync.triggerSource === "scheduled" ? "automático" : "manual"}
          {lastSync.finishedAt
            ? ` · ${new Date(lastSync.finishedAt).toLocaleString("es-PE")}`
            : ""}
          ):{" "}
          {lastSync.outcome === "empty"
            ? "0 transacciones (no es error)"
            : lastSync.outcome === "ok"
              ? `${lastSync.rowCount ?? 0} fila(s)`
              : "error"}
        </p>
      ) : null}
      <FormField label="Public key Ecart Pay" htmlFor="ecart-public-key">
        <Input
          id="ecart-public-key"
          type="text"
          autoComplete="off"
          placeholder={connected ? "(pegar nueva public key para rotar)" : "pub…"}
          value={publicKey}
          onChange={(e) => setPublicKey(e.target.value)}
          disabled={pending}
        />
      </FormField>
      <FormField label="Private key Ecart Pay" htmlFor="ecart-private-key">
        <Input
          id="ecart-private-key"
          type="password"
          autoComplete="off"
          placeholder={connected ? "(pegar nueva private key para rotar)" : "priv…"}
          value={privateKey}
          onChange={(e) => setPrivateKey(e.target.value)}
          disabled={pending}
        />
      </FormField>
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          disabled={pending || !canConnect}
          onClick={() => {
            setError(null);
            setSuccess(null);
            setInfo(null);
            start(async () => {
              const r = await connectEcartPay(agencySlug, storeSlug, {
                publicKey,
                privateKey,
              });
              if (r.error) {
                setError(r.error);
                return;
              }
              setSuccess(
                connected
                  ? "Claves Ecart Pay actualizadas."
                  : "Ecart Pay conectado (claves guardadas). Sync automático cada ~8h.",
              );
              setPublicKey("");
              setPrivateKey("");
              router.refresh();
            });
          }}
        >
          {connected ? "Actualizar claves" : "Conectar Ecart Pay"}
        </Button>
        <Button
          type="button"
          variant="secondary"
          disabled={pending || !connected}
          onClick={() => {
            setError(null);
            setSuccess(null);
            setInfo(null);
            start(async () => {
              const r = await syncEcartPaySettlements(agencySlug, storeSlug, { days: 30 });
              if (r.error) {
                setError(r.error);
                return;
              }
              if (r.outcome === "empty") {
                setInfo(r.message ?? "0 transacciones, no es error.");
              } else {
                setSuccess(r.message ?? `Sync encolado${r.jobId ? ` (job ${r.jobId.slice(0, 8)}…)` : ""}.`);
              }
              router.refresh();
            });
          }}
        >
          Sincronizar ahora (30d)
        </Button>
      </div>
      {error ? <Alert variant="danger">{error}</Alert> : null}
      {info ? <Alert variant="info">{info}</Alert> : null}
      {success ? <Alert variant="success">{success}</Alert> : null}
    </div>
  );
}
