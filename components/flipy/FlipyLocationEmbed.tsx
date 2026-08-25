"use client";

import { useEffect, useRef, useState } from "react";
import { reverseGeocodeFlipyLocationAction } from "@/app/actions/flipy-widgets";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { FormField, Input } from "@/components/ui";
import {
  evaluateDestinationConsistency,
  formatCoordsLabel,
  isWeakLocationAddress,
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
 * On confirm: always sync lat/lng (+ best address) to the parent; reverse-geocode
 * when the embed returns a weak address like "Perú".
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
  const prefillAddressRef = useRef(prefillAddress);
  const prefillCoordsRef = useRef(prefillCoords);
  prefillAddressRef.current = prefillAddress;
  prefillCoordsRef.current = prefillCoords;

  function emitConfirmed(destination: FlipyDestination) {
    setPendingCoords(null);
    setWarning(null);
    setError(null);
    setHint(`Ubicación aplicada: ${destination.address || formatCoordsLabel(destination.lat, destination.lng)}`);
    onConfirmedRef.current(destination);
  }

  async function enrichAndEmit(input: { address: string; lat: number; lng: number; reasons: string[] }) {
    // Always push pin to parent first so recojo/entrega fields track the map.
    emitConfirmed({
      address: input.address.trim() || `Pin ${formatCoordsLabel(input.lat, input.lng)}`,
      lat: input.lat,
      lng: input.lng,
    });

    setResolving(true);
    setWarning(
      input.reasons.length
        ? `Mejorando dirección del pin (${input.reasons.join(", ")})…`
        : "Obteniendo dirección del pin…",
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
        setWarning(null);
        return;
      }
      setPendingCoords({ lat: input.lat, lng: input.lng });
      setManualAddress(input.address.trim());
      setWarning(
        `Pin en ${formatCoordsLabel(input.lat, input.lng)} aplicado, pero el texto del mapa no es confiable` +
          (input.address ? ` (“${input.address}”).` : ".") +
          " Edita la dirección abajo o escribe una más precisa.",
      );
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
          prefillAddress: prefillAddressRef.current,
          prefillCoords: prefillCoordsRef.current,
        });
        const weak = isWeakLocationAddress(confirmed.address);
        if (!consistency.ok || weak) {
          void enrichAndEmit({
            address: confirmed.address,
            lat: confirmed.lat,
            lng: confirmed.lng,
            reasons: weak
              ? [...consistency.reasons.filter((r) => r !== "address_too_generic"), "address_too_generic"]
              : consistency.reasons,
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
  }, [embedOrigin, agencySlug, storeSlug]);

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
      ? "Mueve el pin y pulsa “Confirmar ubicación” en el mapa para actualizar la dirección de recojo abajo."
      : "Mueve el pin y pulsa “Confirmar ubicación” en el mapa para actualizar la dirección de entrega abajo.";

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
          key={mapSrc}
          title={purpose === "pickup" ? "Mapa Flipy — recojo" : "Mapa Flipy — entrega"}
          src={mapSrc}
          className={`block w-full border-0 ${mapHeightClassName}`}
          allow="geolocation"
          tabIndex={0}
        />
      </div>
      {resolving ? <p className="text-xs text-text-secondary">Actualizando dirección desde el pin…</p> : null}
      {hint ? <p className="text-xs text-emerald-600">{hint}</p> : null}
      {warning ? (
        <Alert variant="warning" title="Dirección vs pin">
          <div className="space-y-2">
            <p>{warning}</p>
            {pendingCoords ? (
              <>
                <FormField
                  label={purpose === "pickup" ? "Dirección de recojo (edición manual)" : "Dirección de entrega (edición manual)"}
                  htmlFor="flipy-manual-dest"
                >
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
