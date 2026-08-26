"use client";

import { X } from "lucide-react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { issueFlipyWidgetTokenAction } from "@/app/actions/flipy-widgets";
import { FlipyLocationEmbed } from "@/components/flipy/FlipyLocationEmbed";
import type { FlipyStoreOriginDefaults } from "@/lib/integrations/flipy/route-address";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { FormField, Input } from "@/components/ui";
import type { FlipyRoutePoint } from "@/lib/integrations/flipy/route-address";
import {
  hasFlipyRouteLocation,
  peMobileDigits,
  validateFlipyRoutePoint,
} from "@/lib/integrations/flipy/route-address";
import { cn } from "@/lib/utils/cn";

export type FlipyMapEmbedPrefetch = {
  embedUrl: string;
  embedOrigin: string;
  prefillKey: string;
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  kind: "pickup" | "delivery";
  agencySlug: string;
  storeSlug: string;
  orderId: string;
  embedOrigin: string;
  value: FlipyRoutePoint;
  mapPrefillAddress?: string | null;
  mapPrefillCoords?: { lat: number; lng: number } | null;
  storeOrigin?: FlipyStoreOriginDefaults | null;
  defaultContactName?: string | null;
  defaultContactPhone?: string | null;
  defaultContactEmail?: string | null;
  prefetchedEmbed?: FlipyMapEmbedPrefetch | null;
  onSave: (point: FlipyRoutePoint) => void;
  /** Live pin coords while editing — used to prefetch flete cotización. */
  onLiveCoordsChange?: (coords: { lat: number; lng: number }) => void;
};

export function buildMapPrefillKey(input: {
  address?: string | null;
  lat?: number | null;
  lng?: number | null;
}): string {
  const lat = input.lat != null && Number.isFinite(input.lat) ? input.lat : "";
  const lng = input.lng != null && Number.isFinite(input.lng) ? input.lng : "";
  return `${input.address?.trim() ?? ""}|${lat}|${lng}`;
}

export function resolveMapPrefill(input: {
  value: FlipyRoutePoint;
  mapPrefillAddress?: string | null;
  mapPrefillCoords?: { lat: number; lng: number } | null;
  isPickup: boolean;
  storeOrigin?: FlipyStoreOriginDefaults | null;
}): { address: string | null; lat: number | null; lng: number | null } {
  const address =
    input.mapPrefillAddress ??
    (hasFlipyRouteLocation(input.value) ? input.value.address : null) ??
    (input.isPickup ? (input.storeOrigin?.address ?? null) : null);
  const lat =
    input.mapPrefillCoords?.lat ??
    (hasFlipyRouteLocation(input.value) ? input.value.lat : null) ??
    (input.isPickup ? (input.storeOrigin?.lat ?? null) : null);
  const lng =
    input.mapPrefillCoords?.lng ??
    (hasFlipyRouteLocation(input.value) ? input.value.lng : null) ??
    (input.isPickup ? (input.storeOrigin?.lng ?? null) : null);
  return { address, lat, lng };
}

export function FlipyRouteAddressModal({
  open,
  onOpenChange,
  kind,
  agencySlug,
  storeSlug,
  orderId,
  embedOrigin,
  value,
  mapPrefillAddress = null,
  mapPrefillCoords = null,
  storeOrigin = null,
  defaultContactName = null,
  defaultContactPhone = null,
  defaultContactEmail = null,
  prefetchedEmbed = null,
  onSave,
  onLiveCoordsChange,
}: Props) {
  const [draft, setDraft] = useState<FlipyRoutePoint>(value);
  const [embedUrl, setEmbedUrl] = useState<string | null>(null);
  const [resolvedEmbedOrigin, setResolvedEmbedOrigin] = useState(embedOrigin);
  const [mapNonce, setMapNonce] = useState(0);
  const [tokenLoading, setTokenLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const loadedPrefillKeyRef = useRef<string | null>(null);

  const title = kind === "pickup" ? "Recojo" : "Entrega";
  const isPickup = kind === "pickup";
  const mapPrefill = resolveMapPrefill({
    value,
    mapPrefillAddress,
    mapPrefillCoords,
    isPickup,
    storeOrigin,
  });
  const mapPrefillKey = buildMapPrefillKey(mapPrefill);
  const hasWarmPrefetch = prefetchedEmbed?.prefillKey === mapPrefillKey;

  useEffect(() => {
    if (!open) return;
    setDraft(value);
    setError(null);
    setLoadError(null);
  }, [open, value]);

  useLayoutEffect(() => {
    if (!hasWarmPrefetch || !prefetchedEmbed) return;
    if (
      loadedPrefillKeyRef.current === mapPrefillKey &&
      embedUrl === prefetchedEmbed.embedUrl
    ) {
      return;
    }
    setEmbedUrl(prefetchedEmbed.embedUrl);
    setResolvedEmbedOrigin(prefetchedEmbed.embedOrigin);
    loadedPrefillKeyRef.current = mapPrefillKey;
    setLoadError(null);
  }, [hasWarmPrefetch, prefetchedEmbed, mapPrefillKey, embedUrl]);

  useEffect(() => {
    if (!open) return;
    if (embedUrl && loadedPrefillKeyRef.current === mapPrefillKey) return;
    if (hasWarmPrefetch) return;

    let cancelled = false;
    setTokenLoading(true);
    setLoadError(null);

    void (async () => {
      const tokenResult = await issueFlipyWidgetTokenAction({
        agencySlug,
        storeSlug,
        orderId,
        prefillAddress: mapPrefill.address,
        prefillLat: mapPrefill.lat ?? undefined,
        prefillLng: mapPrefill.lng ?? undefined,
      });
      if (cancelled) return;
      setTokenLoading(false);
      if (tokenResult.error || !tokenResult.embedUrl) {
        setLoadError(tokenResult.error ?? "No se pudo cargar el mapa Flipy.");
        return;
      }
      setEmbedUrl(tokenResult.embedUrl);
      setResolvedEmbedOrigin(tokenResult.embedOrigin ?? embedOrigin);
      loadedPrefillKeyRef.current = mapPrefillKey;
      setMapNonce((n) => n + 1);
    })();

    return () => {
      cancelled = true;
    };
  }, [
    open,
    hasWarmPrefetch,
    embedUrl,
    mapPrefillKey,
    agencySlug,
    storeSlug,
    orderId,
    embedOrigin,
    mapPrefill.address,
    mapPrefill.lat,
    mapPrefill.lng,
  ]);

  function reloadMap(input: {
    address: string;
    lat: number;
    lng: number;
  }) {
    setLoadError(null);
    setTokenLoading(true);
    void (async () => {
      const tokenResult = await issueFlipyWidgetTokenAction({
        agencySlug,
        storeSlug,
        orderId,
        prefillAddress: input.address,
        prefillLat: input.lat,
        prefillLng: input.lng,
      });
      setTokenLoading(false);
      if (tokenResult.error || !tokenResult.embedUrl) {
        setLoadError(tokenResult.error ?? "No se pudo recargar el mapa.");
        return;
      }
      setEmbedUrl(tokenResult.embedUrl);
      setResolvedEmbedOrigin(tokenResult.embedOrigin ?? embedOrigin);
      loadedPrefillKeyRef.current = buildMapPrefillKey(input);
      setMapNonce((n) => n + 1);
    })();
  }

  function applyStoreAddress() {
    if (!storeOrigin) {
      setError("No hay origen de tienda Flipy configurado.");
      return;
    }
    setError(null);
    setDraft((prev) => ({
      ...prev,
      address: storeOrigin.address,
      lat: storeOrigin.lat,
      lng: storeOrigin.lng,
      pinConfirmed: true,
    }));
    reloadMap({
      address: storeOrigin.address,
      lat: storeOrigin.lat,
      lng: storeOrigin.lng,
    });
  }

  function applyStoreContact() {
    if (!storeOrigin) {
      setError("No hay datos de contacto de tienda Flipy.");
      return;
    }
    setError(null);
    setDraft((prev) => ({
      ...prev,
      contactName: storeOrigin.contactName,
      contactPhone: storeOrigin.phone,
    }));
  }

  function handleSave() {
    const validationError = validateFlipyRoutePoint(draft, kind);
    if (validationError) {
      setError(validationError);
      return;
    }
    setError(null);
    onSave({
      ...draft,
      contactPhone: peMobileDigits(draft.contactPhone),
      contactEmail: draft.contactEmail?.trim() || undefined,
    });
    onOpenChange(false);
  }

  const shouldMount = open || Boolean(embedUrl);
  if (!shouldMount) return null;

  const mapPanel = embedUrl ? (
    <FlipyLocationEmbed
      key={`${kind}-map-${mapNonce}`}
      embedUrl={embedUrl}
      embedOrigin={resolvedEmbedOrigin}
      agencySlug={agencySlug}
      storeSlug={storeSlug}
      purpose={kind === "pickup" ? "pickup" : "delivery"}
      syncMode="partner"
      readOnlyAddress
      prefillAddress={
        hasFlipyRouteLocation(draft) ? draft.address : mapPrefill.address
      }
      prefillCoords={
        hasFlipyRouteLocation(draft)
          ? { lat: draft.lat, lng: draft.lng }
          : mapPrefill.lat != null && mapPrefill.lng != null
            ? { lat: mapPrefill.lat, lng: mapPrefill.lng }
            : null
      }
      mapHeightClassName="h-[min(42vh,420px)] sm:h-[min(45vh,460px)]"
      onConfirmed={(next) => {
        setDraft((prev) => ({
          ...prev,
          address: next.address,
          lat: next.lat,
          lng: next.lng,
          pinConfirmed: true,
        }));
        setError(null);
        onLiveCoordsChange?.({ lat: next.lat, lng: next.lng });
      }}
    />
  ) : (
    <div
      className="flex h-[min(42vh,420px)] items-center justify-center rounded-lg border border-border bg-muted/30 sm:h-[min(45vh,460px)]"
      aria-busy={tokenLoading}
    >
      <p className="text-xs text-text-secondary">
        {tokenLoading ? "Obteniendo acceso al mapa…" : "Preparando mapa Flipy…"}
      </p>
    </div>
  );

  return (
    <div
      className={cn(
        open
          ? "fixed inset-0 z-[60] grid place-items-center p-3 sm:p-4"
          : "pointer-events-none fixed -left-[9999px] top-0 h-[min(45vh,460px)] w-[640px] overflow-hidden opacity-0",
      )}
      role={open ? "dialog" : undefined}
      aria-modal={open ? true : undefined}
      aria-hidden={open ? undefined : true}
      aria-label={open ? title : undefined}
    >
      {open ? (
        <button
          type="button"
          className="absolute inset-0 bg-black/50"
          aria-label="Cerrar"
          onClick={() => onOpenChange(false)}
        />
      ) : null}
      <section
        className={cn(
          "relative z-10 flex w-full max-w-2xl flex-col overflow-hidden rounded-xl bg-surface-elevated shadow-2xl",
          open ? "max-h-[min(92vh,880px)]" : "h-full",
        )}
      >
        {open ? (
          <div className="flex shrink-0 items-center justify-between gap-3 border-b border-border px-5 py-4">
            <h2 className="text-lg font-semibold">{title}</h2>
            <button type="button" aria-label="Cerrar" onClick={() => onOpenChange(false)}>
              <X className="size-5" />
            </button>
          </div>
        ) : null}

        <div
          className={cn(
            "min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain px-5 py-4",
            !open && "h-full p-0",
          )}
        >
          {open && isPickup ? (
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                variant="outline"
                type="button"
                disabled={!storeOrigin || tokenLoading}
                onClick={applyStoreAddress}
              >
                Usar dirección de mi tienda
              </Button>
              <Button
                size="sm"
                variant="outline"
                type="button"
                disabled={!storeOrigin || tokenLoading}
                onClick={applyStoreContact}
              >
                Usar datos de mi tienda
              </Button>
            </div>
          ) : null}

          {open && loadError ? (
            <Alert variant="danger" title="Mapa">
              {loadError}
            </Alert>
          ) : null}

          {mapPanel}

          {open ? (
            <>
              <div className="grid gap-3 sm:grid-cols-2">
                <FormField
                  label={isPickup ? "Quién entrega — nombre" : "Quién recibe — nombre"}
                  htmlFor={`flipy-route-name-${kind}`}
                >
                  <Input
                    id={`flipy-route-name-${kind}`}
                    value={draft.contactName}
                    onChange={(e) =>
                      setDraft((prev) => ({ ...prev, contactName: e.target.value }))
                    }
                    placeholder={defaultContactName ?? undefined}
                  />
                </FormField>
                <FormField
                  label={
                    isPickup
                      ? "Quién entrega — celular (9 dígitos)"
                      : "Quién recibe — celular (9 dígitos)"
                  }
                  htmlFor={`flipy-route-phone-${kind}`}
                >
                  <Input
                    id={`flipy-route-phone-${kind}`}
                    inputMode="tel"
                    value={draft.contactPhone}
                    onChange={(e) =>
                      setDraft((prev) => ({ ...prev, contactPhone: e.target.value }))
                    }
                    placeholder={defaultContactPhone ?? "9XXXXXXXX"}
                  />
                </FormField>
              </div>

              {!isPickup ? (
                <FormField label="Email (opcional, PIN)" htmlFor={`flipy-route-email-${kind}`}>
                  <Input
                    id={`flipy-route-email-${kind}`}
                    type="email"
                    value={draft.contactEmail ?? ""}
                    onChange={(e) =>
                      setDraft((prev) => ({ ...prev, contactEmail: e.target.value }))
                    }
                    placeholder={defaultContactEmail ?? undefined}
                  />
                </FormField>
              ) : null}

              {error ? (
                <Alert variant="danger" title="Revisa los datos">
                  {error}
                </Alert>
              ) : null}
            </>
          ) : null}
        </div>

        {open ? (
          <div className="flex shrink-0 justify-end gap-2 border-t border-border px-5 py-4">
            <Button variant="outline" type="button" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="button" disabled={tokenLoading} onClick={handleSave}>
              Guardar
            </Button>
          </div>
        ) : null}
      </section>
    </div>
  );
}
