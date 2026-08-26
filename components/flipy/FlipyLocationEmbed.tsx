"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { reverseGeocodeFlipyLocationAction } from "@/app/actions/flipy-widgets";
import { Alert } from "@/components/ui/Alert";
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
  /** standalone = confirm in iframe; partner = live pin sync (fullscreen host). */
  syncMode?: "standalone" | "partner";
  /** When true, address field below map is read-only (modal UX). */
  readOnlyAddress?: boolean;
  onConfirmed: (destination: FlipyDestination) => void;
};

const PIN_SYNC_DEBOUNCE_MS = 450;

export function FlipyLocationEmbed({
  embedUrl,
  embedOrigin,
  agencySlug,
  storeSlug,
  prefillAddress,
  prefillCoords,
  mapHeightClassName = "h-[min(58vh,520px)]",
  purpose = "delivery",
  syncMode = "standalone",
  readOnlyAddress = false,
  onConfirmed,
}: Props) {
  const liveSync = syncMode === "partner";
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [liveAddress, setLiveAddress] = useState(prefillAddress?.trim() ?? "");
  const [liveCoords, setLiveCoords] = useState<{ lat: number; lng: number } | null>(
    prefillCoords ?? null,
  );
  const [resolving, setResolving] = useState(false);
  const [syncStatus, setSyncStatus] = useState<string>(
    liveSync
      ? "Mueve el pin en el mapa para elegir la ubicación."
      : "Mueve el pin y confirma con el botón verde del mapa.",
  );
  const [parentOrigin, setParentOrigin] = useState<string | null>(null);
  const shellRef = useRef<HTMLDivElement>(null);
  const onConfirmedRef = useRef(onConfirmed);
  const prefillAddressRef = useRef(prefillAddress);
  const prefillCoordsRef = useRef(prefillCoords);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const geocodeRequestRef = useRef(0);
  onConfirmedRef.current = onConfirmed;
  prefillAddressRef.current = prefillAddress;
  prefillCoordsRef.current = prefillCoords;

  useEffect(() => {
    setParentOrigin(window.location.origin);
  }, []);

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  const emitConfirmed = useCallback((destination: FlipyDestination) => {
    setWarning(null);
    setError(null);
    setLiveAddress(destination.address);
    setLiveCoords({ lat: destination.lat, lng: destination.lng });
    setSyncStatus(
      `Ubicación sincronizada · ${formatCoordsLabel(destination.lat, destination.lng)}`,
    );
    onConfirmedRef.current(destination);
  }, []);

  const resolveAddressFromPin = useCallback(
    async (input: { lat: number; lng: number; fallbackAddress?: string }) => {
      const requestId = ++geocodeRequestRef.current;
      setResolving(true);
      setSyncStatus(`Obteniendo dirección para ${formatCoordsLabel(input.lat, input.lng)}…`);
      try {
        const reversed = await reverseGeocodeFlipyLocationAction({
          agencySlug,
          storeSlug,
          lat: input.lat,
          lng: input.lng,
        });
        if (requestId !== geocodeRequestRef.current) return;

        if (!reversed.error && reversed.address?.trim()) {
          emitConfirmed({
            address: reversed.address.trim(),
            lat: reversed.lat ?? input.lat,
            lng: reversed.lng ?? input.lng,
          });
          return;
        }

        const fallback = input.fallbackAddress?.trim();
        if (fallback && !isWeakLocationAddress(fallback)) {
          emitConfirmed({ address: fallback, lat: input.lat, lng: input.lng });
          return;
        }

        emitConfirmed({
          address: `Ubicación ${formatCoordsLabel(input.lat, input.lng)}`,
          lat: input.lat,
          lng: input.lng,
        });
        setWarning(
          "No pudimos obtener la calle exacta. Edita la dirección abajo si hace falta.",
        );
      } finally {
        if (requestId === geocodeRequestRef.current) {
          setResolving(false);
        }
      }
    },
    [agencySlug, emitConfirmed, storeSlug],
  );

  const processLocationUpdate = useCallback(
    (confirmed: { address: string; lat: number; lng: number; provisional?: boolean }) => {
      if (!liveSync && confirmed.provisional) {
        return;
      }

      const consistency = evaluateDestinationConsistency({
        address: confirmed.address,
        lat: confirmed.lat,
        lng: confirmed.lng,
        prefillAddress: prefillAddressRef.current,
        prefillCoords: prefillCoordsRef.current,
      });
      const weak = isWeakLocationAddress(confirmed.address);
      const needsGeocode =
        weak || !consistency.ok || (liveSync && confirmed.provisional === true);

      setLiveCoords({ lat: confirmed.lat, lng: confirmed.lng });

      if (needsGeocode) {
        void resolveAddressFromPin({
          lat: confirmed.lat,
          lng: confirmed.lng,
          fallbackAddress: confirmed.address,
        });
        return;
      }

      emitConfirmed({
        address: confirmed.address.trim(),
        lat: confirmed.lat,
        lng: confirmed.lng,
      });
    },
    [emitConfirmed, liveSync, resolveAddressFromPin],
  );

  const scheduleLocationUpdate = useCallback(
    (confirmed: { address: string; lat: number; lng: number; provisional?: boolean }) => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      const delay = liveSync && confirmed.provisional ? PIN_SYNC_DEBOUNCE_MS : 0;
      debounceRef.current = setTimeout(() => {
        processLocationUpdate(confirmed);
      }, delay);
    },
    [liveSync, processLocationUpdate],
  );

  useEffect(() => {
    function onMessage(event: MessageEvent) {
      if (!isAllowedFlipyPostMessageOrigin(event.origin, embedOrigin)) {
        return;
      }
      const confirmed = parseFlipyLocationMessage(event.data);
      if (confirmed) {
        scheduleLocationUpdate(confirmed);
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
  }, [embedOrigin, scheduleLocationUpdate]);

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

  function commitManualAddress() {
    if (readOnlyAddress) return;
    if (!liveCoords) {
      setError("Primero confirma la ubicación en el mapa.");
      return;
    }
    const trimmed = liveAddress.trim();
    if (!trimmed) {
      setError("Escribe una dirección válida.");
      return;
    }
    setError(null);
    emitConfirmed({
      address: trimmed,
      lat: liveCoords.lat,
      lng: liveCoords.lng,
    });
  }

  const mapSrc = withFlipyLocationClientParams(embedUrl, parentOrigin, { liveSync });
  const addressLabel =
    purpose === "pickup" ? "Dirección de recojo" : "Dirección de entrega";

  return (
    <div className="space-y-3">
      <p className="text-xs text-text-secondary">
        {syncStatus}
        {resolving ? " · actualizando dirección…" : ""}
      </p>
      <div
        ref={shellRef}
        className="relative isolate overflow-hidden rounded-lg border border-border bg-muted/20 shadow-sm overscroll-none"
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

      <FormField label={addressLabel} htmlFor={`flipy-live-address-${purpose}`}>
        <Input
          id={`flipy-live-address-${purpose}`}
          value={liveAddress}
          readOnly={readOnlyAddress}
          onChange={(e) => setLiveAddress(e.target.value)}
          onBlur={() => {
            if (!readOnlyAddress && liveAddress.trim() && liveCoords) commitManualAddress();
          }}
          placeholder={
            readOnlyAddress
              ? "Se completa al confirmar en el mapa"
              : "Se completa al confirmar en el mapa o edítala aquí"
          }
          disabled={resolving || (readOnlyAddress && !liveAddress)}
          className={readOnlyAddress ? "bg-muted/40" : undefined}
        />
      </FormField>
      {liveCoords ? (
        <p className="text-[11px] text-text-secondary">
          Pin: {formatCoordsLabel(liveCoords.lat, liveCoords.lng)}
        </p>
      ) : null}

      {warning ? (
        <Alert variant="warning" title="Revisa la dirección">
          {warning}
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
