"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { issueFlipyWidgetTokenAction } from "@/app/actions/flipy-widgets";
import { Alert } from "@/components/ui/Alert";
import { isAllowedFlipyPostMessageOrigin } from "@/lib/integrations/flipy/embed-urls";
import {
  parseFlipyBidAcceptedMessage,
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
        setStatusHint(
          updated.count != null
            ? `Pujas actualizadas (${updated.count}).`
            : "Pujas actualizadas.",
        );
        router.refresh();
        return;
      }
      const accepted = parseFlipyBidAcceptedMessage(event.data);
      if (accepted) {
        setStatusHint("Puja aceptada en Flipy.");
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
    return <p className="text-[12px] text-text-secondary">Cargando panel de pujas…</p>;
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

  return (
    <div className="space-y-2 rounded-lg border border-border bg-surface-elevated p-3 shadow-[var(--card-shadow)]">
      <h3 className="text-sm font-semibold">Pujas Flipy</h3>
      {statusHint ? <p className="text-xs text-emerald-600">{statusHint}</p> : null}
      <iframe
        key={`${embedUrl}:${reloadKey}`}
        title="Flipy pujas"
        src={embedUrl}
        className="h-[min(48vh,420px)] w-full rounded-md border border-border bg-white"
        sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
        onError={() => setIframeFailed(true)}
      />
    </div>
  );
}
