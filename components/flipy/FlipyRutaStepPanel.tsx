"use client";

import { Box, Check } from "lucide-react";
import type { FlipyFleteQuote } from "@/lib/integrations/flipy/partner-contract";
import type { FlipyPackageCareId } from "@/lib/integrations/flipy/map-package-care";
import { FLIPY_PACKAGE_CARE_IDS, FLIPY_PACKAGE_CARE_LABELS } from "@/lib/integrations/flipy/map-package-care";
import {
  FLIPY_PACKAGE_SIZE_LABELS,
  type FlipyPackageSize,
} from "@/lib/integrations/flipy/map-package-size";
import type { FlipyRoutePoint } from "@/lib/integrations/flipy/route-address";
import { FlipyFleteOfferCard } from "@/components/flipy/FlipyFleteOfferCard";
import { FlipyRouteAddressCard } from "@/components/flipy/FlipyRouteAddressCard";
import { FlipyRutaSummaryBar } from "@/components/flipy/FlipyRutaSummaryBar";
import { FlipyWizardStepper } from "@/components/flipy/FlipyWizardStepper";
import { Alert } from "@/components/ui/Alert";
import { FormField, Input } from "@/components/ui";
import { cn } from "@/lib/utils/cn";

const PACKAGE_SIZE_DESCRIPTIONS: Record<FlipyPackageSize, string> = {
  pequeno: "Hasta 2 kg",
  mediano: "2 – 10 kg",
  grande: "Más de 10 kg",
};

type Props = {
  showModalidadStep: boolean;
  smartEligible: boolean;
  storeOriginAvailable: boolean;
  onApplyStoreOrigin: () => void;
  pickupPoint: FlipyRoutePoint;
  deliveryPoint: FlipyRoutePoint;
  pickupCardError: string | null;
  deliveryCardError: string | null;
  onOpenPickup: () => void;
  onOpenDelivery: () => void;
  fleteQuote: FlipyFleteQuote | null;
  quoting: boolean;
  packageSizes: FlipyPackageSize[];
  packageSize: FlipyPackageSize;
  onPackageSizeChange: (size: FlipyPackageSize) => void;
  packageCare: FlipyPackageCareId[];
  onTogglePackageCare: (id: FlipyPackageCareId) => void;
  packageCareNote: string;
  onPackageCareNoteChange: (value: string) => void;
  fletePrice: string;
  onFletePriceChange: (value: string) => void;
  fleteLocked: boolean;
  quoteError: string | null;
  coordsReady: boolean;
  fleteValidationError: string | null;
  driverNotes: string;
  onDriverNotesChange: (value: string) => void;
  productSummaryLabel: string;
  destinoCobroSummary: string;
  fleteAmount: number | null;
  currencyCode: string;
};

export function FlipyRutaStepPanel({
  showModalidadStep,
  smartEligible,
  storeOriginAvailable,
  onApplyStoreOrigin,
  pickupPoint,
  deliveryPoint,
  pickupCardError,
  deliveryCardError,
  onOpenPickup,
  onOpenDelivery,
  fleteQuote,
  quoting,
  packageSizes,
  packageSize,
  onPackageSizeChange,
  packageCare,
  onTogglePackageCare,
  packageCareNote,
  onPackageCareNoteChange,
  fletePrice,
  onFletePriceChange,
  fleteLocked,
  quoteError,
  coordsReady,
  fleteValidationError,
  driverNotes,
  onDriverNotesChange,
  productSummaryLabel,
  destinoCobroSummary,
  fleteAmount,
  currencyCode,
}: Props) {
  const routeMeta =
    fleteQuote?.distanceKm != null && fleteQuote?.durationMinutes != null
      ? `≈ ${fleteQuote.distanceKm.toFixed(1)} km · tiempo estimado ${fleteQuote.durationMinutes} min`
      : fleteQuote?.distanceKm != null
        ? `≈ ${fleteQuote.distanceKm.toFixed(1)} km`
        : quoting
          ? "Calculando ruta…"
          : coordsReady
            ? "Cotizando distancia…"
            : null;

  return (
    <div className="space-y-6">
      <FlipyWizardStepper
        activeStep="ruta"
        showModalidad={showModalidadStep}
        variant="numbered"
      />

      <p className="text-sm leading-relaxed text-text-secondary">
        Define recojo, entrega, tamaño y cuidados del paquete. Al final indicas tu oferta de flete —
        los motorizados pujan desde ahí hacia arriba.
      </p>

      {smartEligible ? (
        <Alert variant="info" title="Asignación automática (1A)">
          Flete prepagado en Shopify — el flete se fija con la cotización Flipy.
        </Alert>
      ) : null}

      <section className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-[11px] font-semibold uppercase tracking-[0.12em] text-text-secondary">
            Ruta del envío
          </h3>
          {storeOriginAvailable ? (
            <button
              type="button"
              onClick={onApplyStoreOrigin}
              className="text-sm font-medium text-brand-primary hover:underline"
            >
              + Usar dirección de mi tienda
            </button>
          ) : null}
        </div>

        <div className="space-y-0">
          <FlipyRouteAddressCard
            label="Recogida"
            emptyHint="Toca para indicar dónde recogemos el paquete"
            point={pickupPoint}
            error={pickupCardError}
            onPress={onOpenPickup}
          />

          {routeMeta ? (
            <div className="flex items-center gap-3 py-2 pl-5">
              <div className="h-8 w-px border-l-2 border-dashed border-border" aria-hidden />
              <p className="text-xs font-medium text-text-secondary">{routeMeta}</p>
            </div>
          ) : (
            <div className="py-1 pl-5" aria-hidden>
              <div className="h-6 w-px border-l-2 border-dashed border-border" />
            </div>
          )}

          <FlipyRouteAddressCard
            label="Entrega"
            emptyHint="Toca para indicar dónde entregamos el paquete"
            point={deliveryPoint}
            error={deliveryCardError}
            onPress={onOpenDelivery}
            dashedWhenEmpty
          />
        </div>
      </section>

      <section className="space-y-3">
        <h3 className="text-[11px] font-semibold uppercase tracking-[0.12em] text-text-secondary">
          Tamaño y cuidados del paquete
        </h3>

        <div className="grid grid-cols-3 gap-2">
          {packageSizes.map((size) => {
            const selected = packageSize === size;
            return (
              <button
                key={size}
                type="button"
                onClick={() => onPackageSizeChange(size)}
                className={cn(
                  "relative rounded-xl border-2 p-3 text-left transition-colors",
                  selected
                    ? "border-brand-primary bg-brand-softer/50"
                    : "border-border bg-surface-elevated hover:border-brand-primary/35",
                )}
              >
                {selected ? (
                  <span
                    className="absolute right-2 top-2 grid size-5 place-items-center rounded-full bg-brand-primary text-white"
                    aria-hidden
                  >
                    <Check className="size-3" strokeWidth={3} />
                  </span>
                ) : null}
                <Box className="mb-2 size-5 text-brand-primary/80" aria-hidden />
                <span className="block text-sm font-semibold text-text-primary">
                  {FLIPY_PACKAGE_SIZE_LABELS[size]}
                </span>
                <span className="mt-0.5 block text-xs text-text-secondary">
                  {PACKAGE_SIZE_DESCRIPTIONS[size]}
                </span>
              </button>
            );
          })}
        </div>

        <div className="space-y-2">
          <p className="text-sm font-medium text-text-primary">
            Cuidados especiales{" "}
            <span className="font-normal text-text-secondary">(opcional, selecciona los que apliquen)</span>
          </p>
          <div className="flex flex-wrap gap-2">
            {FLIPY_PACKAGE_CARE_IDS.map((id) => {
              const active = packageCare.includes(id);
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => onTogglePackageCare(id)}
                  className={cn(
                    "rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
                    active
                      ? "border-brand-primary bg-brand-softer text-brand-primary"
                      : "border-border bg-surface-elevated text-text-secondary hover:bg-muted/40",
                  )}
                >
                  {FLIPY_PACKAGE_CARE_LABELS[id]}
                  {active ? <span className="ml-1 opacity-70">×</span> : null}
                </button>
              );
            })}
          </div>
          <FormField label="Nota para el motorizado (opcional)" htmlFor="flipy-care-note">
            <Input
              id="flipy-care-note"
              value={packageCareNote}
              onChange={(e) => onPackageCareNoteChange(e.target.value.slice(0, 120))}
              placeholder="Ej: llamar al llegar, dejar en recepción, edificio azul…"
            />
          </FormField>
        </div>
      </section>

      <FlipyFleteOfferCard
        value={fletePrice}
        onChange={onFletePriceChange}
        locked={fleteLocked}
        quoting={quoting}
        quoteError={quoteError}
        fleteQuote={fleteQuote}
        coordsReady={coordsReady}
        validationError={fleteValidationError}
        variant="ruta"
      />

      <FormField label="Notas para el motorizado (opcional)" htmlFor="flipy-notes">
        <Input
          id="flipy-notes"
          value={driverNotes}
          onChange={(e) => onDriverNotesChange(e.target.value)}
          placeholder="Timbre, referencia, horario…"
        />
      </FormField>

      <FlipyRutaSummaryBar
        productLabel={productSummaryLabel}
        fleteAmount={fleteAmount}
        destinoCobroLabel={destinoCobroSummary}
        currencyCode={currencyCode}
      />
    </div>
  );
}
