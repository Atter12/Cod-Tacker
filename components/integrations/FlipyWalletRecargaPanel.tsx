"use client";

import { useState, useTransition } from "react";
import { issueFlipyWidgetTokenAction } from "@/app/actions/flipy-widgets";
import { buildFlipyAppLoginUrl } from "@/lib/integrations/flipy/embed-urls";
import { FlipyWalletEmbed } from "@/components/flipy/FlipyWalletEmbed";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";

type Props = {
  agencySlug: string;
  storeSlug: string;
  embedOrigin: string;
  appOrigin: string;
  contactEmail?: string | null;
  orderId?: string | null;
};

const SUGGESTED_TOPUP = "50.00";

export function FlipyWalletRecargaPanel({
  agencySlug,
  storeSlug,
  embedOrigin,
  appOrigin,
  contactEmail = null,
  orderId = null,
}: Props) {
  const [open, setOpen] = useState(false);
  const [embedUrl, setEmbedUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function loadEmbed() {
    setError(null);
    start(async () => {
      const tokenResult = await issueFlipyWidgetTokenAction({
        agencySlug,
        storeSlug,
        orderId: orderId ?? undefined,
        scope: "wallet_topup",
      });
      if (tokenResult.error || !tokenResult.embedUrl) {
        setError(tokenResult.error ?? "No se pudo cargar recarga embed.");
        return;
      }
      setEmbedUrl(tokenResult.embedUrl);
      setOpen(true);
    });
  }

  return (
    <div className="space-y-3" id="flipy-recarga">
      <div className="rounded-[11px] border border-border bg-surface-elevated p-4 shadow-[var(--card-shadow)] sm:p-5">
        <div className="flex items-start gap-3">
          <div
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand-soft text-sm font-semibold text-brand-primary"
            aria-hidden
          >
            +
          </div>
          <div className="min-w-0 space-y-1">
            <h2 className="text-sm font-semibold text-text-primary">Recargar billetera</h2>
            <p className="text-[12.5px] leading-relaxed text-text-secondary">
              Recarga <span className="font-medium text-text-primary">Operaciones</span> vía embed
              Flipy{" "}
              <code className="rounded bg-muted px-1 py-0.5 text-[11px] text-text-secondary">F3</code>.
              También disponible al crear un envío si el saldo es insuficiente.
            </p>
          </div>
        </div>

        <div className="mt-4 flex h-11 items-center justify-between rounded-md border border-border bg-muted/30 px-3">
          <span className="text-sm text-text-secondary">Recargar</span>
          <span className="text-sm font-semibold tabular-nums text-text-primary">
            S/ {SUGGESTED_TOPUP}
          </span>
        </div>
        <p className="mt-1.5 text-[11px] text-text-secondary">
          Monto de referencia — eliges el importe real en el embed de Flipy.
        </p>

        {error ? (
          <div className="mt-3">
            <Alert variant="warning" title="Recarga">
              {error}
            </Alert>
          </div>
        ) : null}

        <div className="mt-4 flex flex-wrap gap-2">
          <Button size="sm" disabled={pending} onClick={() => loadEmbed()}>
            {pending ? "Cargando…" : "Recargar embed"}
          </Button>
          <a
            href={buildFlipyAppLoginUrl({ appOrigin, contactEmail })}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-8 items-center justify-center rounded-md border border-border bg-surface-elevated px-3 text-xs font-medium text-text-primary transition-colors hover:bg-muted"
          >
            Abrir app
          </a>
        </div>

        {open && embedUrl ? (
          <div className="mt-4 space-y-2">
            <FlipyWalletEmbed embedUrl={embedUrl} embedOrigin={embedOrigin} />
            <Button size="sm" variant="outline" onClick={() => setOpen(false)}>
              Cerrar recarga
            </Button>
          </div>
        ) : null}
      </div>

      <div className="rounded-[11px] border border-border bg-surface-elevated p-4 shadow-[var(--card-shadow)] sm:p-5">
        <p className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.1em] text-text-secondary">
          <span
            className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-border text-[10px] font-bold"
            aria-hidden
          >
            i
          </span>
          Cómo funciona
        </p>
        <ol className="mt-3 space-y-2.5">
          <li className="flex gap-2.5 text-[12.5px] leading-relaxed text-text-secondary">
            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand-soft text-[11px] font-semibold text-brand-primary">
              1
            </span>
            <span>
              COD-tracked <span className="font-medium text-text-primary">no guarda ni pide</span> tu
              contraseña de Flipy.
            </span>
          </li>
          <li className="flex gap-2.5 text-[12.5px] leading-relaxed text-text-secondary">
            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand-soft text-[11px] font-semibold text-brand-primary">
              2
            </span>
            <span>
              Un correo operativo ={" "}
              <span className="font-medium text-text-primary">una tienda Flipy</span> (limitación de
              Flipy).
            </span>
          </li>
          <li className="flex gap-2.5 text-[12.5px] leading-relaxed text-text-secondary">
            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand-soft text-[11px] font-semibold text-brand-primary">
              3
            </span>
            <span>
              El enlace de activación caduca en{" "}
              <span className="font-medium text-text-primary">~1 hora</span>. Si expira, vuelve a
              pulsar{" "}
              <code className="rounded border border-border bg-muted px-1 py-0.5 text-[11px]">
                Activar cuenta
              </code>
              .
            </span>
          </li>
        </ol>
      </div>
    </div>
  );
}
