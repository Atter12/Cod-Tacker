"use client";

import {
  Box,
  Clock,
  Info,
  MapPin,
  Pencil,
  Route,
  TriangleAlert,
} from "lucide-react";
import type { FlipyFleteQuote } from "@/lib/integrations/flipy/partner-contract";
import {
  FLIPY_PACKAGE_CARE_LABELS,
  type FlipyPackageCareId,
} from "@/lib/integrations/flipy/map-package-care";
import {
  FLIPY_PACKAGE_SIZE_LABELS,
  type FlipyPackageSize,
} from "@/lib/integrations/flipy/map-package-size";
import type { FlipyEscenarioPago } from "@/lib/integrations/flipy/resolve-payment";
import {
  formatFlipyRouteContactLine,
  peMobileDigits,
  type FlipyRoutePoint,
} from "@/lib/integrations/flipy/route-address";
import { formatCurrency } from "@/lib/formatting/currency";
import { formatCoordsLabel } from "@/lib/integrations/flipy/destination-consistency";
import { FlipyWizardStepper } from "@/components/flipy/FlipyWizardStepper";
import { Alert } from "@/components/ui/Alert";
import { cn } from "@/lib/utils/cn";

const PACKAGE_SIZE_DESCRIPTIONS: Record<FlipyPackageSize, string> = {
  pequeno: "Hasta 2 kg",
  mediano: "2 – 10 kg",
  grande: "Más de 10 kg",
};

const ESCENARIO_COBRO_TITLE: Record<Exclude<FlipyEscenarioPago, "GRATIS">, string> = {
  "1A": "Prepago total",
  "1C": "Cobro en destino · Yape al motorizado",
  "1E": "Cobro en destino · Efectivo al motorizado",
  "1D": "Cobro en destino · Digital en rastreo",
};

type Props = {
  showModalidadStep: boolean;
  smartEligible: boolean;
  escenario: FlipyEscenarioPago;
  pickupPoint: FlipyRoutePoint;
  deliveryPoint: FlipyRoutePoint;
  fleteQuote: FlipyFleteQuote | null;
  packageSize: FlipyPackageSize;
  packageCare: FlipyPackageCareId[];
  packageCareNote: string;
  driverNotes: string;
  fleteAmount: number | null;
  fleteLocked: boolean;
  codProductAmount: number | null;
  productPaidAtCheckout: boolean;
  shippingPaidAtCheckout: boolean;
  currencyCode: string;
  termsAccepted: boolean;
  onTermsAcceptedChange: (value: boolean) => void;
  termsUrl: string;
  onEditRuta: () => void;
  onEditModalidad: () => void;
  destinationInconsistent?: boolean;
};

function SectionHeader({
  title,
  onEdit,
}: {
  title: string;
  onEdit?: () => void;
}) {
  return (
    <div className="flex items-center justify-between gap-2">
      <h3 className="text-[11px] font-semibold uppercase tracking-[0.12em] text-text-secondary">
        {title}
      </h3>
      {onEdit ? (
        <button
          type="button"
          onClick={onEdit}
          className="inline-flex items-center gap-1 text-sm font-medium text-brand-primary transition-colors hover:text-brand-primary/80"
        >
          <Pencil className="size-3.5" aria-hidden />
          Editar
        </button>
      ) : null}
    </div>
  );
}

function RoutePoint({
  marker,
  markerVariant,
  badge,
  badgeClassName,
  address,
  contactLine,
  coords,
  isLast,
}: {
  marker: string;
  markerVariant: "outline" | "solid";
  badge: string;
  badgeClassName: string;
  address: string;
  contactLine: string | null;
  coords: string;
  isLast?: boolean;
}) {
  return (
    <div className="flex gap-3">
      <div className="flex flex-col items-center pt-0.5">
        <span
          className={cn(
            "grid size-7 shrink-0 place-items-center rounded-full text-xs font-bold",
            markerVariant === "solid"
              ? "bg-brand-primary text-white"
              : "border-2 border-brand-primary text-brand-primary",
          )}
        >
          {marker}
        </span>
        {!isLast ? (
          <div className="my-1 min-h-8 w-px flex-1 border-l-2 border-dashed border-border" aria-hidden />
        ) : null}
      </div>
      <div className={cn("min-w-0 flex-1 pb-4", isLast ? "pb-0" : null)}>
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={cn(
              "rounded px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
              badgeClassName,
            )}
          >
            {badge}
          </span>
        </div>
        <p className="mt-1.5 text-sm font-medium leading-snug text-text-primary">{address}</p>
        {contactLine ? (
          <p className="mt-1 text-xs text-text-secondary">{contactLine}</p>
        ) : null}
        <p className="mt-0.5 font-mono text-[11px] text-text-secondary/80">{coords}</p>
      </div>
    </div>
  );
}

function extractDistrictHint(address: string): string | null {
  const parts = address
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
  if (parts.length >= 2) return parts[parts.length - 1] ?? null;
  return null;
}

export function FlipyConfirmStepPanel({
  showModalidadStep,
  smartEligible,
  escenario,
  pickupPoint,
  deliveryPoint,
  fleteQuote,
  packageSize,
  packageCare,
  packageCareNote,
  driverNotes,
  fleteAmount,
  fleteLocked,
  codProductAmount,
  productPaidAtCheckout,
  shippingPaidAtCheckout,
  currencyCode,
  termsAccepted,
  onTermsAcceptedChange,
  termsUrl,
  onEditRuta,
  onEditModalidad,
  destinationInconsistent,
}: Props) {
  const pickupContact = formatFlipyRouteContactLine(pickupPoint);
  const deliveryContact = [
    deliveryPoint.contactName.trim(),
    peMobileDigits(deliveryPoint.contactPhone),
    deliveryPoint.contactEmail?.trim(),
  ]
    .filter(Boolean)
    .join(" · ");

  const motorizadoNote =
    [driverNotes.trim(), packageCareNote.trim()].filter(Boolean).join(" · ") ||
    "Sin instrucciones adicionales";

  const productCharge =
    !productPaidAtCheckout && codProductAmount != null && codProductAmount > 0
      ? codProductAmount
      : 0;
  const fleteCharge =
    !shippingPaidAtCheckout && fleteAmount != null && fleteAmount > 0 ? fleteAmount : 0;
  const totalDestino = productCharge + fleteCharge;

  const districtHint = extractDistrictHint(deliveryPoint.address);
  const distanceLabel =
    fleteQuote?.distanceKm != null
      ? `${fleteQuote.distanceKm.toFixed(1)} km aprox.`
      : null;
  const durationLabel =
    fleteQuote?.durationMinutes != null
      ? `~${fleteQuote.durationMinutes} min en moto`
      : null;

  const bidAlertBody =
    fleteAmount != null && fleteAmount > 0
      ? smartEligible
        ? "Flipy asignará el motorizado más cercano con flete fijo según cotización."
        : `Publicaremos el envío por ${formatCurrency(fleteAmount, currencyCode)}. Los motorizados cercanos pujarán y podrán ofrecer un monto mayor. Recibirás notificación cuando alguien acepte.`
      : smartEligible
        ? "Flipy asignará el motorizado más cercano con flete fijo según cotización."
        : "Los motorizados competirán por tu oferta de flete.";

  return (
    <div className="space-y-6">
      <FlipyWizardStepper
        activeStep="confirmacion"
        showModalidad={showModalidadStep}
        variant="numbered"
      />

      <div
        className={cn(
          "rounded-xl border border-l-4 p-4",
          smartEligible
            ? "border-brand-secondary/30 border-l-brand-secondary bg-brand-secondary/10"
            : "border-amber-200/80 border-l-amber-500 bg-amber-50/80 dark:border-amber-900/40 dark:bg-amber-950/20",
        )}
        role="note"
      >
        <div className="flex gap-3">
          <TriangleAlert
            className={cn(
              "mt-0.5 size-5 shrink-0",
              smartEligible ? "text-brand-secondary" : "text-amber-700 dark:text-amber-400",
            )}
            aria-hidden
          />
          <div>
            <p
              className={cn(
                "font-semibold",
                smartEligible ? "text-brand-secondary" : "text-amber-900 dark:text-amber-200",
              )}
            >
              {smartEligible ? "Asignación automática" : "Los motorizados pujarán por tu oferta"}
            </p>
            <p
              className={cn(
                "mt-1 text-sm leading-relaxed",
                smartEligible ? "text-brand-secondary/90" : "text-amber-800/90 dark:text-amber-300/90",
              )}
            >
              {bidAlertBody}
            </p>
          </div>
        </div>
      </div>

      <section className="space-y-3">
        <SectionHeader title="Ruta del envío" onEdit={onEditRuta} />
        <div className="rounded-xl border border-border bg-surface-elevated p-4">
          <RoutePoint
            marker="A"
            markerVariant="outline"
            badge="Confirmado"
            badgeClassName="bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
            address={pickupPoint.address}
            contactLine={pickupContact}
            coords={formatCoordsLabel(pickupPoint.lat, pickupPoint.lng)}
          />
          <RoutePoint
            marker="B"
            markerVariant="solid"
            badge="Destino"
            badgeClassName="bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300"
            address={deliveryPoint.address}
            contactLine={deliveryContact || null}
            coords={formatCoordsLabel(deliveryPoint.lat, deliveryPoint.lng)}
            isLast
          />
          {distanceLabel || durationLabel || districtHint ? (
            <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-dashed border-border pt-3 text-xs text-text-secondary">
              {distanceLabel ? (
                <span className="inline-flex items-center gap-1.5">
                  <Route className="size-3.5 text-brand-primary/70" aria-hidden />
                  {distanceLabel}
                </span>
              ) : null}
              {durationLabel ? (
                <span className="inline-flex items-center gap-1.5">
                  <Clock className="size-3.5 text-brand-primary/70" aria-hidden />
                  {durationLabel}
                </span>
              ) : null}
              {districtHint ? (
                <span className="inline-flex items-center gap-1.5">
                  <MapPin className="size-3.5 text-brand-primary/70" aria-hidden />
                  {districtHint}
                </span>
              ) : null}
            </div>
          ) : null}
        </div>
      </section>

      <section className="space-y-3">
        <SectionHeader title="Paquete y contacto" onEdit={onEditRuta} />
        <div className="rounded-xl border border-border bg-surface-elevated p-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-text-secondary">
                Tamaño
              </p>
              <p className="mt-1 inline-flex items-center gap-2 text-sm font-medium text-text-primary">
                <Box className="size-4 text-brand-primary/80" aria-hidden />
                {FLIPY_PACKAGE_SIZE_LABELS[packageSize]} · {PACKAGE_SIZE_DESCRIPTIONS[packageSize]}
              </p>
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-text-secondary">
                Cuidados
              </p>
              <div className="mt-1 flex flex-wrap gap-1.5">
                {packageCare.length > 0 ? (
                  packageCare.map((id) => (
                    <span
                      key={id}
                      className="rounded-md bg-brand-softer px-2 py-0.5 text-xs font-semibold text-brand-primary"
                    >
                      {FLIPY_PACKAGE_CARE_LABELS[id]}
                    </span>
                  ))
                ) : (
                  <span className="text-sm text-text-secondary">Ninguno</span>
                )}
              </div>
            </div>
            <div className="sm:col-span-2">
              <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-text-secondary">
                Nota para el motorizado
              </p>
              <p className="mt-1 text-sm italic text-text-secondary">{motorizadoNote}</p>
            </div>
          </div>
        </div>
      </section>

      <section className="space-y-3">
        <SectionHeader title="Cobro y modalidad" onEdit={onEditModalidad} />
        <div className="overflow-hidden rounded-xl border border-border bg-surface-elevated">
          <div className="flex items-start justify-between gap-3 border-b border-dashed border-border px-4 py-3">
            <div className="flex min-w-0 items-start gap-2">
              <span className="mt-1.5 size-2 shrink-0 rounded-full bg-brand-primary" aria-hidden />
              <p className="text-sm font-semibold text-text-primary">
                {escenario === "GRATIS"
                  ? "Envío gratuito"
                  : ESCENARIO_COBRO_TITLE[escenario]}
              </p>
            </div>
            <span className="shrink-0 rounded-md bg-muted px-2 py-0.5 text-[11px] font-bold text-text-secondary">
              {escenario}
            </span>
          </div>

          <div className="space-y-2 border-b border-dashed border-border px-4 py-3 text-sm">
            <div className="flex items-center justify-between gap-3">
              <span className="text-text-secondary">
                Producto (P)
                {productPaidAtCheckout ? " — prepago en Shopify" : " — COD en destino"}
              </span>
              <span className="font-medium text-text-primary">
                {formatCurrency(productCharge, currencyCode)}
              </span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-text-secondary">
                {fleteLocked ? "Flete (F) — cotización Flipy" : "Flete (F) — tu oferta de puja"}
              </span>
              <span className="font-medium text-text-primary">
                {formatCurrency(fleteCharge, currencyCode)}
              </span>
            </div>
          </div>

          <div className="flex items-center justify-between gap-3 px-4 py-3">
            <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-text-secondary">
              Total a cobrar en destino
            </span>
            <span className="text-xl font-bold text-brand-primary">
              {formatCurrency(totalDestino, currencyCode)}
            </span>
          </div>

          <div className="flex items-start gap-2 border-t border-dashed border-border px-4 py-3 text-xs leading-relaxed text-text-secondary">
            <Info className="mt-0.5 size-3.5 shrink-0 text-brand-primary" aria-hidden />
            <p>
              El motorizado cobrará <span className="font-semibold text-text-primary">P + F</span>{" "}
              {escenario === "1C"
                ? "vía Yape"
                : escenario === "1D"
                  ? "con tarjeta en rastreo"
                  : escenario === "1A"
                    ? "— nada en destino"
                    : "en efectivo"}{" "}
              según lo que falte cobrar en Shopify.
            </p>
          </div>
        </div>
      </section>

      <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-border bg-muted/20 p-4">
        <input
          type="checkbox"
          checked={termsAccepted}
          onChange={(event) => onTermsAcceptedChange(event.target.checked)}
          className="mt-0.5 size-4 shrink-0 accent-brand-primary"
        />
        <span className="text-sm leading-relaxed text-text-secondary">
          Acepto que la oferta puede aumentar si un motorizado puja más alto y confirmo los datos
          de recogida y entrega. Ver{" "}
          <a
            href={termsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="font-semibold text-brand-primary hover:underline"
            onClick={(event) => event.stopPropagation()}
          >
            términos de Flipy
          </a>
          .
        </span>
      </label>

      {destinationInconsistent ? (
        <Alert variant="danger" title="Destino inconsistente">
          No se puede crear: la dirección textual no coincide con el pin. Vuelve a Ruta.
        </Alert>
      ) : null}
    </div>
  );
}
