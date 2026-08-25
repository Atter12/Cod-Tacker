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
import {
  isAllowedFlipyPostMessageOrigin,
  withFlipyLocationClientParams,
} from "@/lib/integrations/flipy/embed-urls";
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
  mapHeightClassName?: string;
  purpose?: "pickup" | "delivery";
  onConfirmed: (destination: FlipyDestination) => void;
};

/**
 * Host for Flipy `/partner/ubicacion`.
 * Syncs CT form fields whenever the embed posts location confirm/update.
 * Fallback: paste pin lat/lng from the iframe and reverse-geocode.
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
  const [syncStatus, setSyncStatus] = useState<string>(
    "Esperando “Confirmar ubicación” del mapa…",
  );
  const [fallbackLat, setFallbackLat] = useState("");
  const [fallbackLng, setFallbackLng] = useState("");
  const [parentOrigin, setParentOrigin] = useState<string | null>(null);
  const shellRef = useRef<HTMLDivElement>(null);
  const onConfirmedRef = useRef(onConfirmed);
  onConfirmedRef.current = onConfirmed;
  const prefillAddressRef = useRef(prefillAddress);
  const prefillCoordsRef = useRef(prefillCoords);
  prefillAddressRef.current = prefillAddress;
  prefillCoordsRef.current = prefillCoords;

  useEffect(() => {
    setParentOrigin(window.location.origin);
  }, []);

  function emitConfirmed(destination: FlipyDestination) {
    setPendingCoords(null);
    setWarning(null);
    setError(null);
    setHint(`Dirección actualizada: ${destination.address || formatCoordsLabel(destination.lat, destination.lng)}`);
    setSyncStatus(
      `Sincronizado ${formatCoordsLabel(destination.lat, destination.lng)} → formulario`,
    );
    setFallbackLat(String(destination.lat));
    setFallbackLng(String(destination.lng));
    onConfirmedRef.current(destination);
  }

  async function enrichAndEmit(input: {
    address: string;
    lat: number;
    lng: number;
    reasons: string[];
  }) {
    emitConfirmed({
      address: input.address.trim() || `Pin ${formatCoordsLabel(input.lat, input.lng)}`,
      lat: input.lat,
      lng: input.lng,
    });

    if (!input.reasons.length && !isWeakLocationAddress(input.address)) {
      return;
    }

    setResolving(true);
    setWarning("Obteniendo dirección textual del pin…");
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
        `Pin aplicado (${formatCoordsLabel(input.lat, input.lng)}), pero el texto del mapa no es confiable` +
          (input.address ? ` (“${input.address}”).` : ".") +
          " Edita la dirección abajo.",
      );
    } finally {
      setResolving(false);
    }
  }

  function handleLocationFromEmbed(confirmed: {
    address: string;
    lat: number;
    lng: number;
    provisional?: boolean;
  }) {
    setFallbackLat(String(confirmed.lat));
    setFallbackLng(String(confirmed.lng));
    const consistency = evaluateDestinationConsistency({
      address: confirmed.address,
      lat: confirmed.lat,
      lng: confirmed.lng,
      prefillAddress: prefillAddressRef.current,
      prefillCoords: prefillCoordsRef.current,
    });
    const weak = isWeakLocationAddress(confirmed.address);
    if (weak || !consistency.ok) {
      void enrichAndEmit({
        address: confirmed.address,
        lat: confirmed.lat,
        lng: confirmed.lng,
        reasons: [
          ...(weak ? ["address_too_generic"] : []),
          ...consistency.reasons.filter((r) => r !== "address_too_generic"),
        ],
      });
      return;
    }
    emitConfirmed({
      address: confirmed.address,
      lat: confirmed.lat,
      lng: confirmed.lng,
    });
  }

  async function applyFallbackCoords() {
    const lat = Number.parseFloat(fallbackLat.replace(",", "."));
    const lng = Number.parseFloat(fallbackLng.replace(",", "."));
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      setError("Ingresa lat y lng numéricos del pin (como en “Pin: …” del mapa).");
      return;
    }
    setError(null);
    await enrichAndEmit({
      address: "",
      lat,
      lng,
      reasons: ["manual_pin_apply"],
    });
  }

  useEffect(() => {
    function onMessage(event: MessageEvent) {
      if (!isAllowedFlipyPostMessageOrigin(event.origin, embedOrigin)) {
        // Help diagnose silent drops (wrong host / parentOrigin).
        if (
          event.data &&
          typeof event.data === "object" &&
          typeof (event.data as { type?: string }).type === "string" &&
          String((event.data as { type: string }).type).includes("location")
        ) {
          setSyncStatus(`Mensaje de mapa ignorado (origin ${event.origin})`);
        }
        return;
      }
      const confirmed = parseFlipyLocationMessage(event.data);
      if (confirmed) {
        handleLocationFromEmbed(confirmed);
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
        setSyncStatus("Error del mapa Flipy");
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

  const mapSrc = withFlipyLocationClientParams(embedUrl, parentOrigin);
  const intro =
    purpose === "pickup"
      ? "Mueve el pin y pulsa el botón verde “Confirmar ubicación” dentro del mapa. Eso actualiza “Dirección de recojo” abajo (mover el pin solo no alcanza)."
      : "Mueve el pin y pulsa “Confirmar ubicación” en el mapa para actualizar la dirección de entrega abajo.";

  return (
    <div className="space-y-2">
      <Alert variant="info" title="Cómo actualizar la dirección">
        {intro}
      </Alert>
      <p className="text-xs text-text-secondary">{syncStatus}</p>
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

      <div className="rounded-lg border border-dashed border-border p-3 space-y-2">
        <p className="text-xs font-medium text-text-primary">
          Si el mapa no sincroniza: copia lat/lng de “Pin: …” y aplica aquí
        </p>
        <div className="grid gap-2 sm:grid-cols-2">
          <FormField label="Lat" htmlFor="flipy-fallback-lat">
            <Input
              id="flipy-fallback-lat"
              inputMode="decimal"
              value={fallbackLat}
              onChange={(e) => setFallbackLat(e.target.value)}
              placeholder="-12.11741"
            />
          </FormField>
          <FormField label="Lng" htmlFor="flipy-fallback-lng">
            <Input
              id="flipy-fallback-lng"
              inputMode="decimal"
              value={fallbackLng}
              onChange={(e) => setFallbackLng(e.target.value)}
              placeholder="-77.01239"
            />
          </FormField>
        </div>
        <Button size="sm" disabled={resolving} onClick={() => void applyFallbackCoords()}>
          {resolving ? "Geocodificando…" : "Aplicar pin → actualizar dirección"}
        </Button>
      </div>

      {warning ? (
        <Alert variant="warning" title="Dirección vs pin">
          <div className="space-y-2">
            <p>{warning}</p>
            {pendingCoords ? (
              <>
                <FormField
                  label={
                    purpose === "pickup"
                      ? "Dirección de recojo (edición manual)"
                      : "Dirección de entrega (edición manual)"
                  }
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
