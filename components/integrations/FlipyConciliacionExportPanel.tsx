"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { syncFlipySettlements } from "@/app/actions/flipy-settlement";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { FormField } from "@/components/ui/FormField";
import { Input } from "@/components/ui/Input";
import { routes } from "@/config/routes";

type Props = {
  agencySlug: string;
  storeSlug: string;
  apiBaseUrl: string;
  flipyTiendaId?: string | null;
  canManage?: boolean;
};

function defaultRange(): { from: string; to: string } {
  const to = new Date();
  const from = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);
  return {
    from: from.toISOString().slice(0, 10),
    to: to.toISOString().slice(0, 10),
  };
}

export function FlipyConciliacionExportPanel({
  agencySlug,
  storeSlug,
  apiBaseUrl,
  flipyTiendaId = null,
  canManage = false,
}: Props) {
  const router = useRouter();
  const tiendaId = flipyTiendaId?.trim();
  const initial = defaultRange();
  const [from, setFrom] = useState(initial.from);
  const [to, setTo] = useState(initial.to);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  if (!tiendaId) return null;

  const exportUrl = `${apiBaseUrl.replace(/\/$/, "")}/api/partner/tiendas/${encodeURIComponent(tiendaId)}/conciliacion/export?format=settlement`;

  function runSync() {
    setError(null);
    setSuccess(null);
    startTransition(() => {
      void (async () => {
        const result = await syncFlipySettlements({
          agencySlug,
          storeSlug,
          from,
          to,
        });
        if (result.error) {
          setError(result.error);
          return;
        }
        setSuccess(result.message ?? "Sincronización encolada.");
        router.refresh();
      })();
    });
  }

  return (
    <div className="space-y-3 rounded-[11px] border border-border bg-surface-elevated p-4 shadow-[var(--card-shadow)] ring-1 ring-brand-primary/10">
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-brand-primary">
          Conciliación Flipy
        </p>
        <h2 className="mt-0.5 text-sm font-semibold text-text-primary">Sincronizar cobros</h2>
        <p className="mt-1 text-[12.5px] leading-relaxed text-text-secondary">
          Trae cobros COD desde Flipy. Los pedidos matched pasan a{" "}
          <span className="font-medium text-text-primary">Cobrado</span>; liquida el lote en
          Conciliación. CSV manual queda como fallback.
        </p>
      </div>

      {canManage ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <FormField label="Desde" htmlFor="flipy-settle-from">
            <Input
              id="flipy-settle-from"
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              disabled={pending}
            />
          </FormField>
          <FormField label="Hasta" htmlFor="flipy-settle-to">
            <Input
              id="flipy-settle-to"
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              disabled={pending}
            />
          </FormField>
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        {canManage ? (
          <Button type="button" onClick={runSync} disabled={pending}>
            {pending ? "Sincronizando…" : "Sincronizar ahora"}
          </Button>
        ) : null}
        <Link
          href={routes.store.reconciliation(agencySlug, storeSlug)}
          className="text-xs font-medium text-brand-primary hover:underline"
        >
          Ir a Conciliación
        </Link>
      </div>

      {success ? (
        <Alert variant="success" title="Conciliación">
          {success}
        </Alert>
      ) : null}
      {error ? (
        <Alert variant="danger" title="No se pudo sincronizar">
          {error}
        </Alert>
      ) : null}

      <details className="rounded-md border border-border/80 bg-surface px-3 py-2">
        <summary className="cursor-pointer text-[12px] font-medium text-text-secondary">
          Fallback CSV (preset flipy_cod)
        </summary>
        <p className="mt-2 break-all font-mono text-[11px] text-text-secondary">{exportUrl}</p>
        <p className="mt-1 text-[11px] text-text-secondary">
          Query opcional: <span className="font-mono">from={from}&amp;to={to}</span>
        </p>
      </details>
    </div>
  );
}
