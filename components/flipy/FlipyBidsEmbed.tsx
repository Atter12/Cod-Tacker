"use client";

import { useEffect, useState } from "react";
import { issueFlipyWidgetTokenAction } from "@/app/actions/flipy-widgets";
import { buildFlipyBidsEmbedUrl } from "@/lib/integrations/flipy/embed-urls";
import { Alert } from "@/components/ui/Alert";

type Props = {
  agencySlug: string;
  storeSlug: string;
  orderId: string;
  envioId: string;
  embedOrigin: string;
};

export function FlipyBidsEmbed({ agencySlug, storeSlug, orderId, envioId, embedOrigin }: Props) {
  const [embedUrl, setEmbedUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void issueFlipyWidgetTokenAction({
      agencySlug,
      storeSlug,
      orderId,
      scope: "bids_panel",
    }).then((result) => {
      if (cancelled) return;
      if (result.error || !result.data) {
        setError(result.error ?? "No se pudo cargar el panel de pujas.");
        return;
      }
      setEmbedUrl(
        buildFlipyBidsEmbedUrl({
          embedOrigin,
          token: result.data.token,
          envioId,
        }),
      );
    });
    return () => {
      cancelled = true;
    };
  }, [agencySlug, storeSlug, orderId, envioId, embedOrigin]);

  if (error) {
    return (
      <Alert variant="warning" title="Panel pujas no disponible">
        {error}
      </Alert>
    );
  }

  if (!embedUrl) {
    return <p className="text-[12px] text-text-secondary">Cargando panel de pujas…</p>;
  }

  return (
    <div className="space-y-2 rounded-lg border border-border bg-surface-elevated p-3">
      <h3 className="text-sm font-semibold">Pujas Flipy (evaluación)</h3>
      <iframe
        title="Flipy pujas"
        src={embedUrl}
        className="h-[320px] w-full rounded-md border border-border bg-white"
        sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
      />
    </div>
  );
}
