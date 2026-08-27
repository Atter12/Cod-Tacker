"use client";

import { useState, useTransition } from "react";
import { issueFlipyWidgetTokenAction } from "@/app/actions/flipy-widgets";
import { issueFlipyActivationUrlAction } from "@/app/actions/flipy-activation";
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
  activationPath?: string;
  externalStoreId?: string | null;
  flipyTiendaId?: string | null;
  orderId?: string | null;
};

export function FlipyWalletRecargaPanel({
  agencySlug,
  storeSlug,
  embedOrigin,
  appOrigin,
  contactEmail = null,
  activationPath,
  externalStoreId = null,
  flipyTiendaId = null,
  orderId = null,
}: Props) {
  const [open, setOpen] = useState(false);
  const [embedUrl, setEmbedUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const [activationPending, startActivation] = useTransition();

  function openActivation() {
    if (!contactEmail?.trim()) return;
    setError(null);
    startActivation(async () => {
      const result = await issueFlipyActivationUrlAction({
        agencySlug,
        storeSlug,
        contactEmail: contactEmail.trim(),
      });
      if (result.error || !result.activationUrl) {
        setError(result.error ?? "No se pudo iniciar la activación Flipy.");
        return;
      }
      window.open(result.activationUrl, "_blank", "noopener,noreferrer");
    });
  }

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
    <div className="rounded-lg border border-border bg-surface-elevated p-4">
      <h2 className="text-sm font-semibold">Recarga billetera</h2>
      <p className="mt-1 text-[12.5px] text-text-secondary">
        Recarga Operaciones vía embed Flipy (F3). Si tienes Ganancias COD, también puedes pasarlas a
        Operaciones desde la billetera arriba. También disponible al crear envío si el saldo es
        insuficiente.
      </p>
      {error ? (
        <div className="mt-3">
          <Alert variant="warning" title="Recarga">
            {error}
          </Alert>
        </div>
      ) : null}
      <div className="mt-3 flex flex-wrap gap-2">
        <Button size="sm" disabled={pending} onClick={() => loadEmbed()}>
          {pending ? "Cargando…" : "Recargar embed"}
        </Button>
        {contactEmail ? (
          <Button
            size="sm"
            variant="outline"
            disabled={activationPending}
            onClick={() => openActivation()}
          >
            {activationPending ? "Preparando…" : "Activar cuenta Flipy"}
          </Button>
        ) : (
          <a
            href={buildFlipyAppLoginUrl({ appOrigin, contactEmail })}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-8 items-center justify-center rounded-md border border-border px-3 text-xs font-medium hover:bg-muted"
          >
            Abrir app Flipy
          </a>
        )}
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
  );
}
