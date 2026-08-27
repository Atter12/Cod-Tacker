"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { issueFlipyWidgetTokenAction } from "@/app/actions/flipy-widgets";
import { Alert } from "@/components/ui/Alert";
import { isAllowedFlipyPostMessageOrigin } from "@/lib/integrations/flipy/embed-urls";
import {
  parseFlipyBidAcceptedMessage,
  parseFlipyBidRejectedMessage,
  parseFlipyBidsErrorMessage,
  parseFlipyBidsUpdatedMessage,
} from "@/lib/integrations/flipy/post-message";

type Props = {
  agencySlug: string;
  storeSlug: string;
  orderId: string;
  envioId: string;
  embedOrigin: string;
};

export function FlipyBidsEmbed({ agencySlug, storeSlug, orderId, envioId, embedOrigin }: Props) {
  const router = useRouter();
  const [embedUrl, setEmbedUrl] = useState<string | null>(null);
  const [resolvedOrigin, setResolvedOrigin] = useState(embedOrigin);
  const [error, setError] = useState<string | null>(null);
  const [statusHint, setStatusHint] = useState<string | null>(null);
  const [bidCount, setBidCount] = useState<number | null>(null);
  const [iframeFailed, setIframeFailed] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  const load = useCallback(() => {
    let cancelled = false;
    setError(null);
    setIframeFailed(false);
    setEmbedUrl(null);
    void issueFlipyWidgetTokenAction({
      agencySlug,
      storeSlug,
      orderId,
      envioId,
      scope: "bids_panel",
    }).then((result) => {
      if (cancelled) return;
      if (result.error || !result.embedUrl) {
        setError(result.error ?? "No se pudo cargar el panel de pujas.");
        return;
      }
      setEmbedUrl(result.embedUrl);
      setResolvedOrigin(result.embedOrigin ?? embedOrigin);
    });
    return () => {
      cancelled = true;
    };
  }, [agencySlug, storeSlug, orderId, envioId, embedOrigin]);

  useEffect(() => {
    const cancel = load();
    return cancel;
  }, [load, reloadKey]);

  useEffect(() => {
    function onMessage(event: MessageEvent) {
      if (!isAllowedFlipyPostMessageOrigin(event.origin, resolvedOrigin)) return;
      const updated = parseFlipyBidsUpdatedMessage(event.data);
      if (updated) {
        if (updated.count != null) setBidCount(updated.count);
        setStatusHint(
          updated.count != null
            ? `Ofertas actualizadas (${updated.count}).`
            : "Ofertas actualizadas.",
        );
        router.refresh();
        return;
      }
      const accepted = parseFlipyBidAcceptedMessage(event.data);
      if (accepted) {
        setStatusHint("Oferta aceptada. Motorizado asignado.");
        router.refresh();
        return;
      }
      const rejected = parseFlipyBidRejectedMessage(event.data);
      if (rejected) {
        if (rejected.bidsRemaining != null) setBidCount(rejected.bidsRemaining);
        setStatusHint(
          rejected.bidsRemaining != null
            ? `Oferta rechazada. Quedan ${rejected.bidsRemaining}.`
            : "Oferta rechazada.",
        );
        router.refresh();
        return;
      }
      const bidsErr = parseFlipyBidsErrorMessage(event.data);
      if (bidsErr) {
        setError(bidsErr.message);
      }
    }
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [resolvedOrigin, router]);

  if (error) {
    return (
      <Alert variant="warning" title="Panel pujas no disponible">
        <div className="space-y-2">
          <p>{error}</p>
          <button
            type="button"
            className="text-xs font-medium underline"
            onClick={() => setReloadKey((k) => k + 1)}
          >
            Reintentar
          </button>
        </div>
      </Alert>
    );
  }

  if (!embedUrl) {
    return (
      <div className="overflow-hidden rounded-[11px] border border-border bg-surface-elevated p-4 shadow-[var(--card-shadow)]">
        <p className="text-[12.5px] text-text-secondary">Cargando ofertas de motorizados…</p>
      </div>
    );
  }

  if (iframeFailed) {
    return (
      <Alert variant="danger" title="No se pudo mostrar el panel de pujas">
        <div className="space-y-2">
          <p>
            El iframe falló (CSP / token / frame-ancestors). Verifica{" "}
            <code className="text-xs">FLIPY_EMBED_ORIGIN=https://flipy-panel.vercel.app</code> en
            Vercel CT y que el token tenga scope <code className="text-xs">bids_panel</code>.
          </p>
          <button
            type="button"
            className="text-xs font-medium underline"
            onClick={() => setReloadKey((k) => k + 1)}
          >
            Reintentar
          </button>
        </div>
      </Alert>
    );
  }

  const subtitle =
    bidCount != null
      ? bidCount === 1
        ? "1 oferta · acepta o rechaza desde el panel"
        : `${bidCount} ofertas · acepta o rechaza desde el panel`
      : "Compara ofertas, rechaza las que no sirvan y acepta una para asignar";

  return (
    <div className="overflow-hidden rounded-[11px] border border-border bg-surface-elevated shadow-[var(--card-shadow)] ring-1 ring-brand-primary/10">
      <div className="border-b border-border bg-brand-softer px-4 py-3">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-brand-primary">
              Pujas Flipy
            </p>
            <p className="mt-0.5 text-[12.5px] leading-snug text-text-secondary">{subtitle}</p>
          </div>
          {bidCount != null ? (
            <span className="shrink-0 rounded-md bg-surface px-2 py-1 text-[11px] font-semibold text-text-primary ring-1 ring-border">
              {bidCount} {bidCount === 1 ? "oferta" : "ofertas"}
            </span>
          ) : null}
        </div>
        {statusHint ? (
          <p className="mt-2 text-[12px] font-medium text-brand-primary">{statusHint}</p>
        ) : null}
      </div>
      <div className="bg-surface px-3 py-3 sm:px-4">
        <iframe
          key={`${embedUrl}:${reloadKey}`}
          title="Flipy pujas"
          src={embedUrl}
          className="h-[min(38vh,340px)] w-full rounded-md border border-border/80 bg-surface"
          sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
          onError={() => setIframeFailed(true)}
        />
      </div>
    </div>
  );
}
