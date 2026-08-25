"use client";

import { useEffect, useRef, useState } from "react";
import { reverseGeocodeFlipyLocationAction } from "@/app/actions/flipy-widgets";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { FormField, Input } from "@/components/ui";
import {
  evaluateDestinationConsistency,
  formatCoordsLabel,
} from "@/lib/integrations/flipy/destination-consistency";
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
  agencySlug: string;
  storeSlug: string;
  prefillAddress?: string | null;
  prefillCoords?: { lat: number; lng: number } | null;
  /** Visual height of the map shell (Flipy-tienda-like). */
  mapHeightClassName?: string;
  /** Copy + iframe title for recojo vs entrega. */
  purpose?: "pickup" | "delivery";
  onConfirmed: (destination: FlipyDestination) => void;
};

/**
 * Host for Flipy `/partner/ubicacion`.
 * Keeps wheel/trackpad over the map from scrolling the CT dialog; tall shell
 * reduces nested scroll inside the iframe (which steals zoom from Google Maps).
 */
export function FlipyLocationEmbed({
  embedUrl,
  embedOrigin,
  agencySlug,
  storeSlug,
  prefillAddress,
  prefillCoords,
  mapHeightClassName = "h-[min(62vh,560px)]",
  purpose = "delivery",
  onConfirmed,
}: Props) {
  const [error, setError] = useState<string | null>(null);
  const [hint, setHint] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [manualAddress, setManualAddress] = useState("");
  const [pendingCoords, setPendingCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [resolving, setResolving] = useState(false);
  const shellRef = useRef<HTMLDivElement>(null);
  const onConfirmedRef = useRef(onConfirmed);
  onConfirmedRef.current = onConfirmed;

  function emitConfirmed(destination: FlipyDestination) {
    setPendingCoords(null);
    setWarning(null);
    setError(null);
    setHint(`Pin confirmado: ${formatCoordsLabel(destination.lat, destination.lng)}`);
    onConfirmedRef.current(destination);
  }

  async function resolveInconsistent(input: {
    address: string;
    lat: number;
    lng: number;
    reasons: string[];
  }) {
    setResolving(true);
    setWarning(
      `La dirección no coincide con el pin (${input.reasons.join(", ")}). Intentando reverse-geocode…`,
    );
    try {
      const reversed = await reverseGeocodeFlipyLocationAction({
        agencySlug,
        storeSlug,
        lat: input.lat,
        lng: input.lng,
      });
      if (!reversed.error && reversed.address) {
        emitConfirmed({
          address: reversed.address,
          lat: reversed.lat ?? input.lat,
          lng: reversed.lng ?? input.lng,
        });
        setManualAddress(reversed.address);
        return;
      }
      setPendingCoords({ lat: input.lat, lng: input.lng });
      setManualAddress("");
      setWarning(
        `Pin en ${formatCoordsLabel(input.lat, input.lng)} pero el texto no es confiable` +
          (input.address ? ` (“${input.address}”).` : ".") +
          " Edita la dirección manualmente o vuelve a confirmar el pin.",
      );
      setHint(null);
    } finally {
      setResolving(false);
    }
  }

  useEffect(() => {
    function onMessage(event: MessageEvent) {
      if (!isAllowedFlipyPostMessageOrigin(event.origin, embedOrigin)) return;
      const confirmed = parseFlipyLocationMessage(event.data);
      if (confirmed) {
        const consistency = evaluateDestinationConsistency({
          address: confirmed.address,
          lat: confirmed.lat,
          lng: confirmed.lng,
          prefillAddress,
          prefillCoords,
        });
        if (!consistency.ok) {
          void resolveInconsistent({
            address: confirmed.address,
            lat: confirmed.lat,
            lng: confirmed.lng,
            reasons: consistency.reasons,
          });
          return;
        }
        emitConfirmed({
          address: confirmed.address,
          lat: confirmed.lat,
          lng: confirmed.lng,
        });
        setManualAddress(confirmed.address);
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
    // eslint-disable-next-line react-hooks/exhaustive-deps -- resolve uses latest prefill via closure on each message
  }, [embedOrigin, prefillAddress, prefillCoords, agencySlug, storeSlug]);

  // Stop the CT dialog from scrolling when the pointer is over the map shell.
  // (Cross-origin iframe zoom still needs Flipy Maps gestureHandling=greedy;
  //  we also pass that hint on the embed URL.)
  useEffect(() => {
    const shell = shellRef.current;
    if (!shell) return;

    function trapWheel(event: WheelEvent) {
      event.stopPropagation();
    }

    function trapTouchMove(event: TouchEvent) {
      event.stopPropagation();
    }

    shell.addEventListener("wheel", trapWheel, { capture: true, passive: true });
    shell.addEventListener("touchmove", trapTouchMove, { capture: true, passive: true });
    return () => {
      shell.removeEventListener("wheel", trapWheel, true);
      shell.removeEventListener("touchmove", trapTouchMove, true);
    };
  }, []);

  const mapSrc = withMapInteractionParams(embedUrl);
  const intro =
    purpose === "pickup"
      ? "Busca o confirma el punto de recojo en el mapa (como en Flipy tienda). Puedes usar la dirección de tu tienda y ajustar el pin."
      : "Arrastra el pin y confirma la dirección exacta del cliente (no solo el geocode de Shopify).";

  return (
    <div className="space-y-2">
      <p className="text-xs text-text-secondary">
        {intro} Sobre el mapa, la rueda/trackpad hace zoom — no hace scroll del modal.
      </p>
      <div
        ref={shellRef}
        className="relative isolate overflow-hidden rounded-lg border border-border bg-zinc-950 overscroll-none"
        data-flipy-map-shell
      >
        <iframe
          title={purpose === "pickup" ? "Mapa Flipy — recojo" : "Mapa Flipy — entrega"}
          src={mapSrc}
          className={`block w-full border-0 ${mapHeightClassName}`}
          allow="geolocation"
          tabIndex={0}
        />
      </div>
      {hint ? <p className="text-xs text-emerald-600">{hint}</p> : null}
      {warning ? (
        <Alert variant="warning" title="Dirección vs pin">
          <div className="space-y-2">
            <p>{warning}</p>
            {pendingCoords ? (
              <>
                <FormField label="Dirección de entrega (edición manual)" htmlFor="flipy-manual-dest">
                  <Input
                    id="flipy-manual-dest"
                    value={manualAddress}
                    onChange={(e) => setManualAddress(e.target.value)}
                    placeholder="Calle, distrito, ciudad…"
                  />
                </FormField>
                <Button
                  size="sm"
                  disabled={resolving || !manualAddress.trim()}
                  onClick={() =>
                    emitConfirmed({
                      address: manualAddress.trim(),
                      lat: pendingCoords.lat,
                      lng: pendingCoords.lng,
                    })
                  }
                >
                  Usar esta dirección con el pin
                </Button>
              </>
            ) : null}
          </div>
        </Alert>
      ) : null}
      {error ? (
        <Alert variant="danger" title="Ubicación">
          {error}
        </Alert>
      ) : null}
    </div>
  );
}

/** Hint Flipy partner page to use greedy map wheel zoom (ignored if unsupported). */
function withMapInteractionParams(embedUrl: string): string {
  try {
    const url = new URL(embedUrl);
    if (!url.searchParams.has("gestureHandling")) {
      url.searchParams.set("gestureHandling", "greedy");
    }
    if (!url.searchParams.has("mapWheel")) {
      url.searchParams.set("mapWheel", "zoom");
    }
    return url.toString();
  } catch {
    return embedUrl;
  }
}
