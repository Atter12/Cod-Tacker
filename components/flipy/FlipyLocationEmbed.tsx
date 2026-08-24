"use client";

import { useEffect, useState } from "react";
import { Alert } from "@/components/ui/Alert";
import { isAllowedFlipyPostMessageOrigin } from "@/lib/integrations/flipy/embed-urls";
import { parseFlipyLocationMessage } from "@/lib/integrations/flipy/post-message";

export type FlipyDestination = {
  address: string;
  lat: number;
  lng: number;
};

type Props = {
  embedUrl: string;
  embedOrigin: string;
  onConfirmed: (destination: FlipyDestination) => void;
};

export function FlipyLocationEmbed({ embedUrl, embedOrigin, onConfirmed }: Props) {
  const [error, setError] = useState<string | null>(null);
  const [hint, setHint] = useState<string | null>(null);

  useEffect(() => {
    function onMessage(event: MessageEvent) {
      if (!isAllowedFlipyPostMessageOrigin(event.origin, embedOrigin)) return;
      const confirmed = parseFlipyLocationMessage(event.data);
      if (confirmed) {
        setError(null);
        setHint(`Pin confirmado: ${confirmed.lat.toFixed(5)}, ${confirmed.lng.toFixed(5)}`);
        onConfirmed({
          address: confirmed.address,
          lat: confirmed.lat,
          lng: confirmed.lng,
        });
        return;
      }
      if (
        event.data &&
        typeof event.data === "object" &&
        (event.data as { type?: string }).type === "flipy-location-error"
      ) {
        const message =
          typeof (event.data as { message?: string }).message === "string"
            ? (event.data as { message: string }).message
            : "No se pudo confirmar la ubicación.";
        setError(message);
      }
    }
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [embedOrigin, onConfirmed]);

  return (
    <div className="space-y-2">
      <p className="text-xs text-text-secondary">
        Arrastra el pin en el mapa y confirma la dirección. Debe reflejar el punto exacto que el
        cliente indicó, no solo el geocode de Shopify.
      </p>
      <div className="overflow-hidden rounded-lg border border-border bg-zinc-950">
        <iframe
          title="Mapa Flipy"
          src={embedUrl}
          className="h-[min(52vh,420px)] w-full border-0"
          allow="geolocation"
        />
      </div>
      {hint ? <p className="text-xs text-emerald-600">{hint}</p> : null}
      {error ? (
        <Alert variant="danger" title="Ubicación">
          {error}
        </Alert>
      ) : null}
    </div>
  );
}
