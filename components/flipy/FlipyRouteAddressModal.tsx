"use client";

import { X } from "lucide-react";
import { useEffect, useRef, useState, useTransition } from "react";
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
  const [pending, startTransition] = useTransition();
  const [draft, setDraft] = useState<FlipyRoutePoint>(value);
  const [embedUrl, setEmbedUrl] = useState<string | null>(null);
  const [resolvedEmbedOrigin, setResolvedEmbedOrigin] = useState(embedOrigin);
  const [mapNonce, setMapNonce] = useState(0);
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

  useEffect(() => {
    if (!open) return;
    setDraft(value);
    setError(null);
    setLoadError(null);
  }, [open, value]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    const hasWarmPrefetch = prefetchedEmbed?.prefillKey === mapPrefillKey;
    const alreadyLoadedForKey =
      Boolean(embedUrl) && loadedPrefillKeyRef.current === mapPrefillKey;

    // Prefer warm token — skip blank state and avoid remounting the iframe.
    if (hasWarmPrefetch) {
      if (!alreadyLoadedForKey || embedUrl !== prefetchedEmbed.embedUrl) {
        setEmbedUrl(prefetchedEmbed.embedUrl);
        setResolvedEmbedOrigin(prefetchedEmbed.embedOrigin);
        setMapNonce((n) => n + 1);
        loadedPrefillKeyRef.current = mapPrefillKey;
      }
      setLoadError(null);
      return;
    }

    if (alreadyLoadedForKey) return;

    startTransition(async () => {
      const tokenResult = await issueFlipyWidgetTokenAction({
        agencySlug,
        storeSlug,
        orderId,
        prefillAddress: mapPrefill.address,
        prefillLat: mapPrefill.lat ?? undefined,
        prefillLng: mapPrefill.lng ?? undefined,
      });
      if (cancelled) return;
      if (tokenResult.error || !tokenResult.embedUrl) {
        setLoadError(tokenResult.error ?? "No se pudo cargar el mapa Flipy.");
        return;
      }
      setEmbedUrl(tokenResult.embedUrl);
      setResolvedEmbedOrigin(tokenResult.embedOrigin ?? embedOrigin);
      setLoadError(null);
      loadedPrefillKeyRef.current = mapPrefillKey;
      setMapNonce((n) => n + 1);
    });

    return () => {
      cancelled = true;
    };
  }, [
    open,
    agencySlug,
    storeSlug,
    orderId,
    embedOrigin,
    mapPrefillKey,
    prefetchedEmbed,
    mapPrefill.address,
    mapPrefill.lat,
    mapPrefill.lng,
    embedUrl,
  ]);

  function reloadMap(input: {
    address: string;
    lat: number;
    lng: number;
  }) {
    setLoadError(null);
    startTransition(async () => {
      const tokenResult = await issueFlipyWidgetTokenAction({
        agencySlug,
        storeSlug,
        orderId,
        prefillAddress: input.address,
        prefillLat: input.lat,
        prefillLng: input.lng,
      });
      if (tokenResult.error || !tokenResult.embedUrl) {
        setLoadError(tokenResult.error ?? "No se pudo recargar el mapa.");
        return;
      }
      setEmbedUrl(tokenResult.embedUrl);
      setResolvedEmbedOrigin(tokenResult.embedOrigin ?? embedOrigin);
      loadedPrefillKeyRef.current = buildMapPrefillKey(input);
      setMapNonce((n) => n + 1);
    });
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

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[60] grid place-items-center p-3 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <button
        type="button"
        className="absolute inset-0 bg-black/50"
        aria-label="Cerrar"
        onClick={() => onOpenChange(false)}
      />
      <section className="relative z-10 flex max-h-[min(92vh,880px)] w-full max-w-2xl flex-col overflow-hidden rounded-xl bg-surface-elevated shadow-2xl">
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-border px-5 py-4">
          <h2 className="text-lg font-semibold">{title}</h2>
          <button type="button" aria-label="Cerrar" onClick={() => onOpenChange(false)}>
            <X className="size-5" />
          </button>
        </div>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain px-5 py-4">
          {isPickup ? (
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                variant="outline"
                type="button"
                disabled={!storeOrigin || pending}
                onClick={applyStoreAddress}
              >
                Usar dirección de mi tienda
              </Button>
              <Button
                size="sm"
                variant="outline"
                type="button"
                disabled={!storeOrigin || pending}
                onClick={applyStoreContact}
              >
                Usar datos de mi tienda
              </Button>
            </div>
          ) : null}

          {loadError ? (
            <Alert variant="danger" title="Mapa">
              {loadError}
            </Alert>
          ) : null}

          {embedUrl ? (
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
                hasFlipyRouteLocation(draft)
                  ? draft.address
                  : mapPrefill.address
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
              aria-busy={pending}
            >
              <p className="text-xs text-text-secondary">
                {pending ? "Cargando mapa…" : "Preparando mapa Flipy…"}
              </p>
            </div>
          )}

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
        </div>

        <div className="flex shrink-0 justify-end gap-2 border-t border-border px-5 py-4">
          <Button variant="outline" type="button" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button type="button" disabled={pending} onClick={handleSave}>
            Guardar
          </Button>
        </div>
      </section>
    </div>
  );
}
