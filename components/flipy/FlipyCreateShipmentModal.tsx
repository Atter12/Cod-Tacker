"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import {
  cotizarFlipyFlete,
  createFlipyShipmentFromOrder,
} from "@/app/actions/flipy-shipments";
import { issueFlipyWidgetTokenAction } from "@/app/actions/flipy-widgets";
import { FlipyBidsEmbed } from "@/components/flipy/FlipyBidsEmbed";
import { FlipyRouteAddressCard } from "@/components/flipy/FlipyRouteAddressCard";
import { FlipyRouteAddressModal, buildMapPrefillKey, resolveMapPrefill, type FlipyMapEmbedPrefetch } from "@/components/flipy/FlipyRouteAddressModal";
import { FlipyWalletEmbed } from "@/components/flipy/FlipyWalletEmbed";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { FormField, Input } from "@/components/ui";
import { formatCurrency } from "@/lib/formatting/currency";
import {
  evaluateDestinationConsistency,
  formatCoordsLabel,
} from "@/lib/integrations/flipy/destination-consistency";
import { FLIPY_ERROR_CODES } from "@/lib/integrations/flipy/errors";
import { buildFlipyOperationDeepLink } from "@/lib/integrations/flipy/embed-urls";
import {
  getFlipyFleteUiRule,
  initialFleteInputValue,
  isFlipyFleteLocked,
  validateFlipyFletePrice,
} from "@/lib/integrations/flipy/flete-rules";
import {
  flipyEscenarioOptionsForUi,
  initialFlipyEscenarioForUi,
  labelFlipyEscenario,
} from "@/lib/integrations/flipy/labels";
import {
  FLIPY_PACKAGE_CARE_IDS,
  FLIPY_PACKAGE_CARE_LABELS,
  type FlipyPackageCareId,
} from "@/lib/integrations/flipy/map-package-care";
import {
  FLIPY_PACKAGE_SIZE_HINTS,
  FLIPY_PACKAGE_SIZE_LABELS,
  type FlipyPackageSize,
} from "@/lib/integrations/flipy/map-package-size";
import type { FlipyFleteQuote } from "@/lib/integrations/flipy/partner-contract";
import type { FlipyEscenarioPago, FlipyPaymentResolution } from "@/lib/integrations/flipy/resolve-payment";
import {
  emptyFlipyRoutePoint,
  hasFlipyRouteLocation,
  peMobileDigits,
  validateFlipyRoutePoint,
  type FlipyRoutePoint,
  type FlipyStoreOriginDefaults,
} from "@/lib/integrations/flipy/route-address";

export type { FlipyStoreOriginDefaults };

type Props = {
  agencySlug: string;
  storeSlug: string;
  orderId: string;
  orderNumber: string;
  currencyCode: string;
  prefillAddress: string;
  prefillCoords?: { lat: number; lng: number } | null;
  embedOrigin: string;
  appOrigin: string;
  paymentResolution: FlipyPaymentResolution;
  storeOrigin: FlipyStoreOriginDefaults | null;
  defaultPackageSize?: FlipyPackageSize;
  defaultPackageCare?: FlipyPackageCareId[];
  customerName?: string | null;
  customerPhone?: string | null;
  customerEmail?: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

type Step = "payment" | "ruta" | "confirm" | "success" | "recarga";

type CreateResult = {
  envioId: string;
  trackingUrl?: string | null;
  trackingToken?: string | null;
  estado: string;
  fulfillmentMode?: "smart" | "bid" | null;
  assignedMotorizado?: {
    id: string;
    displayName?: string | null;
    etaMinutes?: number | null;
  } | null;
  appWebUrl?: string | null;
  pujasWebUrl?: string | null;
  fleteQuote?: FlipyFleteQuote | null;
};

const PACKAGE_SIZES: FlipyPackageSize[] = ["pequeno", "mediano", "grande"];
const QUOTE_DEBOUNCE_MS = 500;

function buildInitialPickup(storeOrigin: FlipyStoreOriginDefaults | null): FlipyRoutePoint {
  if (!storeOrigin) return emptyFlipyRoutePoint();
  return {
    address: storeOrigin.address,
    lat: storeOrigin.lat,
    lng: storeOrigin.lng,
    contactName: storeOrigin.contactName,
    contactPhone: storeOrigin.phone,
    pinConfirmed: Boolean(storeOrigin.address && Number.isFinite(storeOrigin.lat)),
  };
}

function buildInitialDelivery(input: {
  prefillAddress: string;
  prefillCoords?: { lat: number; lng: number } | null;
  customerName?: string | null;
  customerPhone?: string | null;
  customerEmail?: string | null;
}): FlipyRoutePoint {
  const hasCoords =
    input.prefillCoords != null &&
    Number.isFinite(input.prefillCoords.lat) &&
    Number.isFinite(input.prefillCoords.lng);
  return {
    address: input.prefillAddress.trim(),
    lat: hasCoords ? input.prefillCoords!.lat : NaN,
    lng: hasCoords ? input.prefillCoords!.lng : NaN,
    contactName: input.customerName?.trim() ?? "",
    contactPhone: input.customerPhone?.trim() ?? "",
    contactEmail: input.customerEmail?.trim() ?? "",
    pinConfirmed: Boolean(input.prefillAddress.trim() && hasCoords),
  };
}

function isSmartFallback(result: CreateResult, smartEligible: boolean): boolean {
  return (
    smartEligible &&
    result.fulfillmentMode === "bid" &&
    result.estado === "PENDIENTE_PUJAS"
  );
}

function isSmartSuccess(result: CreateResult, smartEligible: boolean): boolean {
  if (!smartEligible || isSmartFallback(result, smartEligible)) return false;
  return (
    result.fulfillmentMode === "smart" ||
    result.estado === "ASIGNADO" ||
    result.estado === "ASIGNANDO_SMART"
  );
}

export function FlipyCreateShipmentModal({
  agencySlug,
  storeSlug,
  orderId,
  orderNumber,
  currencyCode,
  prefillAddress,
  prefillCoords = null,
  embedOrigin,
  appOrigin,
  paymentResolution,
  storeOrigin,
  defaultPackageSize = "mediano",
  defaultPackageCare = [],
  customerName = null,
  customerPhone = null,
  customerEmail = null,
  open,
  onOpenChange,
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const smartEligible = paymentResolution.smartEligible;
  const fleteContext = useMemo(
    () => ({ smartEligible }),
    [smartEligible],
  );
  const escenarioOptions = useMemo(
    () => flipyEscenarioOptionsForUi(paymentResolution),
    [paymentResolution],
  );
  const skippedSmartPaymentRef = useRef(false);
  const quoteRequestIdRef = useRef(0);

  const [step, setStep] = useState<Step>("payment");
  const [error, setError] = useState<string | null>(null);
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const [walletEmbedUrl, setWalletEmbedUrl] = useState<string | null>(null);
  const [resolvedEmbedOrigin, setResolvedEmbedOrigin] = useState(embedOrigin);
  const [escenario, setEscenario] = useState<FlipyEscenarioPago>(() =>
    initialFlipyEscenarioForUi(paymentResolution),
  );

  const [pickupPoint, setPickupPoint] = useState<FlipyRoutePoint>(() =>
    buildInitialPickup(storeOrigin),
  );
  const [deliveryPoint, setDeliveryPoint] = useState<FlipyRoutePoint>(() =>
    buildInitialDelivery({
      prefillAddress,
      prefillCoords,
      customerName,
      customerPhone,
      customerEmail,
    }),
  );
  const [routeModal, setRouteModal] = useState<"pickup" | "delivery" | null>(null);
  const [mapEmbedPrefetch, setMapEmbedPrefetch] = useState<{
    pickup: FlipyMapEmbedPrefetch | null;
    delivery: FlipyMapEmbedPrefetch | null;
  }>({ pickup: null, delivery: null });
  const [pickupCardError, setPickupCardError] = useState<string | null>(null);
  const [deliveryCardError, setDeliveryCardError] = useState<string | null>(null);

  const [packageSize, setPackageSize] = useState<FlipyPackageSize>(defaultPackageSize);
  const [packageCare, setPackageCare] = useState<FlipyPackageCareId[]>(defaultPackageCare);
  const [packageCareNote, setPackageCareNote] = useState("");

  const [fleteQuote, setFleteQuote] = useState<FlipyFleteQuote | null>(null);
  const [quoting, setQuoting] = useState(false);
  const [quoteError, setQuoteError] = useState<string | null>(null);

  const [fletePrice, setFletePrice] = useState<string>(() =>
    initialFleteInputValue(
      initialFlipyEscenarioForUi(paymentResolution),
      paymentResolution.suggestedFlete,
      { smartEligible },
    ),
  );
  const [notes, setNotes] = useState("");

  const [result, setResult] = useState<CreateResult | null>(null);

  const fleteRule = useMemo(
    () => getFlipyFleteUiRule(escenario, fleteContext),
    [escenario, fleteContext],
  );
  const fleteLocked = isFlipyFleteLocked(fleteContext);
  const fleteValidation = useMemo(
    () => validateFlipyFletePrice(escenario, fletePrice, { ...fleteContext, fleteQuote }),
    [escenario, fletePrice, fleteContext, fleteQuote],
  );

  const destinationConsistency = useMemo(() => {
    if (!hasFlipyRouteLocation(deliveryPoint)) return null;
    return evaluateDestinationConsistency({
      address: deliveryPoint.address,
      lat: deliveryPoint.lat,
      lng: deliveryPoint.lng,
      prefillAddress,
      prefillCoords,
    });
  }, [deliveryPoint, prefillAddress, prefillCoords]);

  const coordsReady =
    hasFlipyRouteLocation(pickupPoint) && hasFlipyRouteLocation(deliveryPoint);

  const requestQuote = useCallback(() => {
    if (!coordsReady) return;
    const requestId = ++quoteRequestIdRef.current;
    setQuoting(true);
    setQuoteError(null);
    startTransition(async () => {
      const quoted = await cotizarFlipyFlete({
        agencySlug,
        storeSlug,
        originLat: pickupPoint.lat,
        originLng: pickupPoint.lng,
        destinationLat: deliveryPoint.lat,
        destinationLng: deliveryPoint.lng,
        packageSize,
      });
      if (requestId !== quoteRequestIdRef.current) return;
      setQuoting(false);
      if (quoted.error || !quoted.fleteQuote) {
        setQuoteError(quoted.error ?? "No se pudo cotizar el flete.");
        setFleteQuote(null);
        return;
      }
      const quote = quoted.fleteQuote;
      setFleteQuote(quote);
      if (fleteLocked) {
        setFletePrice(String(quote.recommendedFare));
      } else if (!fletePrice.trim()) {
        setFletePrice(initialFleteInputValue(escenario, paymentResolution.suggestedFlete, {
          smartEligible,
          fleteQuote: quote,
        }));
      }
    });
  }, [
    agencySlug,
    storeSlug,
    coordsReady,
    pickupPoint.lat,
    pickupPoint.lng,
    deliveryPoint.lat,
    deliveryPoint.lng,
    packageSize,
    fleteLocked,
    fletePrice,
    escenario,
    paymentResolution.suggestedFlete,
    smartEligible,
  ]);

  useEffect(() => {
    if (!open || step !== "ruta") return;
    let cancelled = false;

    const pickupPrefill = resolveMapPrefill({
      value: pickupPoint,
      isPickup: true,
      storeOrigin,
    });
    const deliveryPrefill = resolveMapPrefill({
      value: deliveryPoint,
      mapPrefillAddress: prefillAddress,
      mapPrefillCoords: prefillCoords,
      isPickup: false,
      storeOrigin,
    });

    startTransition(async () => {
      const [pickupToken, deliveryToken] = await Promise.all([
        issueFlipyWidgetTokenAction({
          agencySlug,
          storeSlug,
          orderId,
          prefillAddress: pickupPrefill.address,
          prefillLat: pickupPrefill.lat ?? undefined,
          prefillLng: pickupPrefill.lng ?? undefined,
        }),
        issueFlipyWidgetTokenAction({
          agencySlug,
          storeSlug,
          orderId,
          prefillAddress: deliveryPrefill.address,
          prefillLat: deliveryPrefill.lat ?? undefined,
          prefillLng: deliveryPrefill.lng ?? undefined,
        }),
      ]);
      if (cancelled) return;

      setMapEmbedPrefetch({
        pickup:
          pickupToken.embedUrl
            ? {
                embedUrl: pickupToken.embedUrl,
                embedOrigin: pickupToken.embedOrigin ?? embedOrigin,
                prefillKey: buildMapPrefillKey(pickupPrefill),
              }
            : null,
        delivery:
          deliveryToken.embedUrl
            ? {
                embedUrl: deliveryToken.embedUrl,
                embedOrigin: deliveryToken.embedOrigin ?? embedOrigin,
                prefillKey: buildMapPrefillKey(deliveryPrefill),
              }
            : null,
      });
    });

    return () => {
      cancelled = true;
    };
  }, [
    open,
    step,
    agencySlug,
    storeSlug,
    orderId,
    embedOrigin,
    storeOrigin,
    prefillAddress,
    prefillCoords,
    pickupPoint.address,
    pickupPoint.lat,
    pickupPoint.lng,
    deliveryPoint.address,
    deliveryPoint.lat,
    deliveryPoint.lng,
  ]);

  useEffect(() => {
    if (!open || step !== "ruta" || !coordsReady) return;
    const timer = window.setTimeout(() => requestQuote(), QUOTE_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [open, step, coordsReady, pickupPoint.lat, pickupPoint.lng, deliveryPoint.lat, deliveryPoint.lng, packageSize, requestQuote]);

  function applyStoreOriginToPickupCard() {
    if (!storeOrigin) {
      setError("No hay origen de tienda Flipy configurado. Reconecta la integración con dirección completa.");
      return;
    }
    setError(null);
    setPickupPoint({
      address: storeOrigin.address,
      lat: storeOrigin.lat,
      lng: storeOrigin.lng,
      contactName: storeOrigin.contactName,
      contactPhone: storeOrigin.phone,
      pinConfirmed: true,
    });
    setPickupCardError(null);
  }

  function goToRutaStep() {
    setError(null);
    if (smartEligible) setEscenario("1A");
    setStep("ruta");
  }

  function togglePackageCare(id: FlipyPackageCareId) {
    setPackageCare((prev) =>
      prev.includes(id) ? prev.filter((entry) => entry !== id) : [...prev, id],
    );
  }

  function resetFlow() {
    skippedSmartPaymentRef.current = false;
    quoteRequestIdRef.current = 0;
    setStep("payment");
    setError(null);
    setErrorCode(null);
    setWalletEmbedUrl(null);
    setPickupPoint(buildInitialPickup(storeOrigin));
    setDeliveryPoint(
      buildInitialDelivery({
        prefillAddress,
        prefillCoords,
        customerName,
        customerPhone,
        customerEmail,
      }),
    );
    setRouteModal(null);
    setPickupCardError(null);
    setDeliveryCardError(null);
    setResolvedEmbedOrigin(embedOrigin);
    setResult(null);
    setNotes("");
    setPackageSize(defaultPackageSize);
    setPackageCare(defaultPackageCare);
    setPackageCareNote("");
    setFleteQuote(null);
    setQuoting(false);
    setQuoteError(null);
    const nextEscenario = initialFlipyEscenarioForUi(paymentResolution);
    setEscenario(nextEscenario);
    setFletePrice(
      initialFleteInputValue(nextEscenario, paymentResolution.suggestedFlete, { smartEligible }),
    );
  }

  function closeModal(nextOpen: boolean) {
    if (!nextOpen) resetFlow();
    onOpenChange(nextOpen);
  }

  function validateRuta(): string | null {
    const pickupErr = validateFlipyRoutePoint(pickupPoint, "pickup");
    if (pickupErr) return pickupErr;
    const deliveryErr = validateFlipyRoutePoint(deliveryPoint, "delivery");
    if (deliveryErr) return deliveryErr;
    if (destinationConsistency && !destinationConsistency.ok) {
      return "La dirección de entrega no coincide con el pin. Edítala en Entrega.";
    }
    if (!fleteValidation.ok) return fleteValidation.error ?? "Revisa el flete.";
    return null;
  }

  useEffect(() => {
    if (!open) {
      skippedSmartPaymentRef.current = false;
      return;
    }
    if (!smartEligible || skippedSmartPaymentRef.current) return;
    if (step !== "payment") return;
    skippedSmartPaymentRef.current = true;
    setEscenario("1A");
    setFletePrice(
      initialFleteInputValue("1A", paymentResolution.suggestedFlete, { smartEligible }),
    );
    goToRutaStep();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- one-shot skip on open
  }, [open, smartEligible]);

  function loadWalletEmbed() {
    setError(null);
    startTransition(async () => {
      const tokenResult = await issueFlipyWidgetTokenAction({
        agencySlug,
        storeSlug,
        orderId,
        scope: "wallet_topup",
      });
      if (tokenResult.error || !tokenResult.embedUrl) {
        setError(tokenResult.error ?? "No se pudo cargar la recarga Flipy.");
        return;
      }
      setWalletEmbedUrl(tokenResult.embedUrl);
      setResolvedEmbedOrigin(tokenResult.embedOrigin ?? embedOrigin);
      setStep("recarga");
    });
  }

  function goConfirm() {
    const pickupErr = validateFlipyRoutePoint(pickupPoint, "pickup");
    if (pickupErr) {
      setPickupCardError(pickupErr);
      setError(pickupErr);
      return;
    }
    const deliveryErr = validateFlipyRoutePoint(deliveryPoint, "delivery");
    if (deliveryErr) {
      setDeliveryCardError(deliveryErr);
      setError(deliveryErr);
      return;
    }
    const rutaError = validateRuta();
    if (rutaError) {
      setError(rutaError);
      return;
    }
    setPickupCardError(null);
    setDeliveryCardError(null);
    setError(null);
    setStep("confirm");
  }

  function submitCreate() {
    const rutaError = validateRuta();
    if (rutaError) {
      setError(rutaError);
      setStep("ruta");
      return;
    }
    if (!hasFlipyRouteLocation(deliveryPoint) || !fleteValidation.ok || fleteValidation.value == null) {
      setError(fleteValidation.error ?? "Revisa la oferta de flete.");
      setStep("ruta");
      return;
    }
    setError(null);
    const destination = {
      address: deliveryPoint.address.trim(),
      lat: deliveryPoint.lat,
      lng: deliveryPoint.lng,
    };
    startTransition(async () => {
      const created = await createFlipyShipmentFromOrder({
        agencySlug,
        storeSlug,
        orderId,
        escenarioPago: escenario,
        destination,
        fletePrice: fleteValidation.value,
        fleteQuote,
        packageSize,
        packageCare,
        packageCareNote: packageCareNote.trim() || null,
        destinationEmail: deliveryPoint.contactEmail?.trim() || null,
        smartEligible,
        origin: {
          address: pickupPoint.address.trim(),
          lat: pickupPoint.lat,
          lng: pickupPoint.lng,
          contactName: pickupPoint.contactName.trim(),
          phone: peMobileDigits(pickupPoint.contactPhone),
        },
        destinationContact: {
          name: deliveryPoint.contactName.trim(),
          phone: peMobileDigits(deliveryPoint.contactPhone),
        },
        notes: notes.trim() || null,
      });
      if (created.error || !created.envioId) {
        setError(created.error ?? "No se pudo crear el envío.");
        setErrorCode(typeof created.errorCode === "string" ? created.errorCode : null);
        return;
      }
      setResult({
        envioId: created.envioId,
        trackingUrl: created.trackingUrl,
        trackingToken: created.trackingToken,
        estado: created.estado ?? "PENDIENTE_PUJAS",
        fulfillmentMode: created.fulfillmentMode,
        assignedMotorizado: created.assignedMotorizado,
        appWebUrl: created.appWebUrl,
        pujasWebUrl: created.pujasWebUrl,
        fleteQuote: created.fleteQuote ?? fleteQuote,
      });
      setStep("success");
      router.refresh();
    });
  }

  const title =
    step === "payment"
      ? "Crear envío Flipy — Modalidad"
      : step === "ruta"
        ? "Crear envío Flipy — Paso 1 Ruta"
        : step === "confirm"
          ? "Crear envío Flipy — Confirmar"
          : step === "recarga"
            ? "Recargar billetera Flipy"
            : "Envío creado en Flipy";

  const showRecargaCta =
    errorCode === FLIPY_ERROR_CODES.SALDO_INSUFICIENTE_HOLD ||
    (error?.toLowerCase().includes("saldo") ?? false);
  const flipyOperationLink = result
    ? buildFlipyOperationDeepLink({
        appOrigin,
        envioId: result.envioId,
        appWebUrl: result.appWebUrl,
      })
    : null;

  const escenarioLabel = labelFlipyEscenario(escenario);
  const smartSuccess = result ? isSmartSuccess(result, smartEligible) : false;
  const smartFallback = result ? isSmartFallback(result, smartEligible) : false;
  const showBidsEmbed = result ? !smartSuccess : false;

  return (
    <Dialog open={open} onOpenChange={closeModal} title={title} className="max-w-3xl">
      <div className="space-y-4 text-sm">
        <p className="text-text-secondary">
          Pedido <span className="font-medium text-text-primary">{orderNumber}</span>
          {step !== "payment" && step !== "success" && step !== "recarga" ? (
            <span className="ml-2 text-xs">· {escenarioLabel}</span>
          ) : null}
        </p>

        {error ? (
          <Alert variant="danger" title="Error">
            <div className="space-y-2">
              <p>{error}</p>
              {showRecargaCta ? (
                <Button size="sm" variant="outline" disabled={pending} onClick={() => loadWalletEmbed()}>
                  Recargar en Flipy
                </Button>
              ) : null}
            </div>
          </Alert>
        ) : null}

        {step === "payment" ? (
          <div className="space-y-3">
            <Alert variant="info" title="Modalidad de pago">
              El flete no viene prepagado en Shopify. Elige cómo cobrará el motorizado (1C, 1E o 1D).
            </Alert>
            {paymentResolution.suggestedEscenario === "1C" ||
            paymentResolution.suggestedEscenario === "1E" ||
            paymentResolution.suggestedEscenario === "1D" ? (
              <p className="text-xs text-text-secondary">
                Sugerido según Shopify:{" "}
                <span className="font-medium text-text-primary">
                  {paymentResolution.suggestedEscenario}
                </span>
              </p>
            ) : null}
            <fieldset className="space-y-2">
              {escenarioOptions.map((opt) => (
                <label
                  key={opt.value}
                  className="flex cursor-pointer gap-3 rounded-lg border border-border p-3 hover:bg-muted/40"
                >
                  <input
                    type="radio"
                    name="flipy-escenario"
                    value={opt.value}
                    checked={escenario === opt.value}
                    onChange={() => {
                      setEscenario(opt.value);
                      setFletePrice(
                        initialFleteInputValue(opt.value, paymentResolution.suggestedFlete, {
                          smartEligible,
                          fleteQuote,
                        }),
                      );
                    }}
                    className="mt-1"
                  />
                  <span>
                    <span className="font-medium">{opt.label}</span>
                    <span className="mt-0.5 block text-xs text-text-secondary">{opt.hint}</span>
                  </span>
                </label>
              ))}
            </fieldset>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => closeModal(false)}>
                Cancelar
              </Button>
              <Button disabled={pending} onClick={() => goToRutaStep()}>
                Siguiente: ruta
              </Button>
            </div>
          </div>
        ) : null}

        {step === "ruta" ? (
          <div className="space-y-4">
            <p className="text-sm text-text-secondary">
              Recojo, entrega, flete y tamaño del paquete — como en la app Flipy. Toca cada tarjeta
              para abrir el mapa y contacto.
            </p>

            {smartEligible ? (
              <Alert variant="info" title="Asignación automática (1A)">
                Flete prepagado en Shopify — modalidad 1A aplicada. El flete se fija con la cotización
                Flipy.
              </Alert>
            ) : null}

            {storeOrigin ? (
              <div>
                <Button
                  size="sm"
                  variant="outline"
                  type="button"
                  onClick={applyStoreOriginToPickupCard}
                >
                  Usar dirección de mi tienda (recojo)
                </Button>
              </div>
            ) : null}

            <FlipyRouteAddressCard
              label="Dirección de recogida"
              emptyHint="Toca para indicar dónde recogemos el paquete"
              point={pickupPoint}
              error={pickupCardError}
              onPress={() => {
                setPickupCardError(null);
                setRouteModal("pickup");
              }}
            />

            <FlipyRouteAddressCard
              label="Dirección de entrega"
              emptyHint="Toca para indicar dónde entregamos el paquete"
              point={deliveryPoint}
              error={deliveryCardError}
              onPress={() => {
                setDeliveryCardError(null);
                setRouteModal("delivery");
              }}
            />

            <div className="space-y-2">
              <p className="text-sm font-semibold">Tamaño del paquete</p>
              <div className="grid grid-cols-3 gap-2">
                {PACKAGE_SIZES.map((size) => (
                  <button
                    key={size}
                    type="button"
                    onClick={() => setPackageSize(size)}
                    className={`rounded-lg border p-3 text-left transition-colors ${
                      packageSize === size
                        ? "border-brand-primary bg-brand-primary/5"
                        : "border-border hover:bg-muted/40"
                    }`}
                  >
                    <span className="block text-sm font-medium">{FLIPY_PACKAGE_SIZE_LABELS[size]}</span>
                    <span className="mt-0.5 block text-xs text-text-secondary">
                      {FLIPY_PACKAGE_SIZE_HINTS[size]}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-sm font-semibold">Cuidado del paquete</p>
              <div className="flex flex-wrap gap-2">
                {FLIPY_PACKAGE_CARE_IDS.map((id) => {
                  const active = packageCare.includes(id);
                  return (
                    <button
                      key={id}
                      type="button"
                      onClick={() => togglePackageCare(id)}
                      className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                        active
                          ? "border-brand-primary bg-brand-primary/10 text-brand-primary"
                          : "border-border hover:bg-muted/40"
                      }`}
                    >
                      {FLIPY_PACKAGE_CARE_LABELS[id]}
                    </button>
                  );
                })}
              </div>
              <FormField label="Nota de cuidado (opcional)" htmlFor="flipy-care-note">
                <Input
                  id="flipy-care-note"
                  value={packageCareNote}
                  onChange={(e) => setPackageCareNote(e.target.value.slice(0, 120))}
                  placeholder="Instrucciones adicionales para el motorizado"
                />
              </FormField>
            </div>

            <div className="space-y-2 rounded-lg border border-border bg-muted/20 p-3">
              <FormField label={fleteRule.label} htmlFor="flipy-flete" hint={fleteRule.hint}>
                <Input
                  id="flipy-flete"
                  inputMode="decimal"
                  value={fletePrice}
                  readOnly={fleteLocked}
                  disabled={fleteLocked}
                  onChange={(e) => setFletePrice(e.target.value)}
                  placeholder={
                    fleteQuote?.recommendedFare != null
                      ? String(fleteQuote.recommendedFare)
                      : paymentResolution.suggestedFlete
                        ? String(paymentResolution.suggestedFlete)
                        : "15.00"
                  }
                  className={fleteLocked ? "bg-muted/50" : undefined}
                />
              </FormField>
              {quoting ? (
                <p className="text-xs text-text-secondary">Cotizando flete…</p>
              ) : quoteError ? (
                <p className="text-xs text-danger">{quoteError}</p>
              ) : fleteQuote ? (
                <p className="text-xs text-text-secondary">
                  Cotización Flipy: {formatCurrency(fleteQuote.recommendedFare, currencyCode)}
                  {fleteQuote.distanceKm != null ? ` · ${fleteQuote.distanceKm.toFixed(1)} km` : ""}
                  {fleteQuote.durationMinutes != null ? ` · ~${fleteQuote.durationMinutes} min` : ""}
                  {!fleteLocked && fleteQuote.minOffer != null && fleteQuote.maxOffer != null
                    ? ` · rango S/ ${fleteQuote.minOffer.toFixed(2)}–${fleteQuote.maxOffer.toFixed(2)}`
                    : ""}
                </p>
              ) : coordsReady ? (
                <p className="text-xs text-text-secondary">Completa recojo y entrega para cotizar.</p>
              ) : (
                <p className="text-xs text-text-secondary">Indica recojo y entrega para cotizar el flete.</p>
              )}
              {fleteValidation.ok && fleteValidation.value != null ? (
                <p className="text-xs font-medium text-text-primary">
                  {fleteLocked ? "Flete fijo" : "Oferta"}:{" "}
                  {formatCurrency(fleteValidation.value, currencyCode)}
                </p>
              ) : null}
            </div>

            <FormField label="Notas para el motorizado (opcional)" htmlFor="flipy-notes">
              <Input
                id="flipy-notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Timbre, referencia, horario…"
              />
            </FormField>

            <div className="flex justify-between gap-2">
              <Button
                variant="outline"
                disabled={pending}
                onClick={() => (smartEligible ? closeModal(false) : setStep("payment"))}
              >
                {smartEligible ? "Cancelar" : "Atrás"}
              </Button>
              <Button disabled={pending || !fleteValidation.ok} onClick={() => goConfirm()}>
                Siguiente: confirmar
              </Button>
            </div>
          </div>
        ) : null}

        {step === "confirm" && hasFlipyRouteLocation(deliveryPoint) ? (
          <div className="space-y-3">
            <Alert
              variant={smartEligible ? "info" : "warning"}
              title={smartEligible ? "Asignación automática" : "Motorizados pujarán"}
            >
              {smartEligible
                ? "Flipy asignará el motorizado más cercano con flete fijo según cotización."
                : "Los motorizados competirán por tu oferta de flete."}
            </Alert>
            <dl className="grid gap-3 rounded-lg border border-border bg-muted/30 p-3 text-sm">
              <div>
                <dt className="text-text-secondary">Escenario</dt>
                <dd className="font-medium">{escenarioLabel}</dd>
              </div>
              <div>
                <dt className="text-text-secondary">Recojo</dt>
                <dd>{pickupPoint.address}</dd>
                <dd className="text-xs text-text-secondary">
                  {pickupPoint.contactName} · {peMobileDigits(pickupPoint.contactPhone)} ·{" "}
                  {formatCoordsLabel(pickupPoint.lat, pickupPoint.lng)}
                </dd>
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                <div>
                  <dt className="text-text-secondary">Entrega — dirección</dt>
                  <dd className="font-medium">{deliveryPoint.address}</dd>
                </div>
                <div>
                  <dt className="text-text-secondary">Entrega — pin</dt>
                  <dd className="font-mono text-xs">
                    {formatCoordsLabel(deliveryPoint.lat, deliveryPoint.lng)}
                  </dd>
                </div>
              </div>
              <div>
                <dt className="text-text-secondary">Quién recibe</dt>
                <dd>
                  {deliveryPoint.contactName} · {peMobileDigits(deliveryPoint.contactPhone)}
                  {deliveryPoint.contactEmail ? ` · ${deliveryPoint.contactEmail}` : ""}
                </dd>
              </div>
              <div>
                <dt className="text-text-secondary">Paquete</dt>
                <dd>
                  {FLIPY_PACKAGE_SIZE_LABELS[packageSize]}
                  {packageCare.length
                    ? ` · ${packageCare.map((id) => FLIPY_PACKAGE_CARE_LABELS[id]).join(", ")}`
                    : ""}
                </dd>
              </div>
              <div>
                <dt className="text-text-secondary">{fleteLocked ? "Flete (cotización)" : "Oferta de flete"}</dt>
                <dd className="font-medium">
                  {formatCurrency(fleteValidation.value ?? 0, currencyCode)}
                </dd>
              </div>
              {notes.trim() || packageCareNote.trim() ? (
                <div>
                  <dt className="text-text-secondary">Notas</dt>
                  <dd>{[notes.trim(), packageCareNote.trim()].filter(Boolean).join(" · ")}</dd>
                </div>
              ) : null}
            </dl>
            {destinationConsistency && !destinationConsistency.ok ? (
              <Alert variant="danger" title="Destino inconsistente">
                No se puede crear: la dirección textual no coincide con el pin. Vuelve a Ruta.
              </Alert>
            ) : null}
            <div className="flex justify-between gap-2">
              <Button variant="outline" disabled={pending} onClick={() => setStep("ruta")}>
                Atrás
              </Button>
              <Button
                disabled={
                  pending ||
                  !fleteValidation.ok ||
                  Boolean(destinationConsistency && !destinationConsistency.ok)
                }
                onClick={submitCreate}
              >
                {pending ? "Creando…" : "Crear envío en Flipy"}
              </Button>
            </div>
          </div>
        ) : null}

        {step === "recarga" && walletEmbedUrl ? (
          <div className="space-y-3">
            <FlipyWalletEmbed
              embedUrl={walletEmbedUrl}
              embedOrigin={resolvedEmbedOrigin}
              onToppedUp={() => {
                setError(null);
                setErrorCode(null);
                setStep("confirm");
              }}
            />
            <div className="flex justify-between gap-2">
              <Button variant="outline" disabled={pending} onClick={() => setStep("confirm")}>
                Volver
              </Button>
              <Button disabled={pending} onClick={() => submitCreate()}>
                Reintentar crear envío
              </Button>
            </div>
          </div>
        ) : null}

        {step === "success" && result ? (
          <div className="space-y-3">
            {smartFallback ? (
              <Alert variant="warning" title="Sin motorizado disponible">
                No se encontró motorizado para asignación automática. El envío pasó a modo puja — revisa
                las ofertas abajo.
              </Alert>
            ) : (
              <Alert variant="success" title="Envío creado">
                Estado Flipy: {result.estado}.
                {smartSuccess ? " Asignación automática en curso o completada." : ""}
              </Alert>
            )}

            {smartSuccess && result.assignedMotorizado ? (
              <div className="rounded-lg border border-border bg-muted/30 p-3">
                <p className="text-xs text-text-secondary">Motorizado asignado</p>
                <p className="font-medium">
                  {result.assignedMotorizado.displayName ?? result.assignedMotorizado.id}
                </p>
                {result.assignedMotorizado.etaMinutes != null ? (
                  <p className="text-xs text-text-secondary">
                    ETA ~{result.assignedMotorizado.etaMinutes} min
                  </p>
                ) : null}
              </div>
            ) : smartSuccess && result.estado === "ASIGNANDO_SMART" ? (
              <div className="rounded-lg border border-border bg-muted/30 p-3">
                <p className="text-sm font-medium">Buscando motorizado…</p>
                <p className="text-xs text-text-secondary">
                  Flipy está asignando el motorizado más cercano.
                </p>
              </div>
            ) : null}

            <dl className="grid gap-2 text-sm">
              <div>
                <dt className="text-text-secondary">ID envío</dt>
                <dd className="font-mono text-xs">{result.envioId}</dd>
              </div>
              {result.trackingToken ? (
                <div>
                  <dt className="text-text-secondary">Tracking</dt>
                  <dd className="font-mono text-xs">{result.trackingToken}</dd>
                </div>
              ) : null}
            </dl>

            {showBidsEmbed ? (
              <FlipyBidsEmbed
                agencySlug={agencySlug}
                storeSlug={storeSlug}
                orderId={orderId}
                envioId={result.envioId}
                embedOrigin={embedOrigin}
              />
            ) : null}

            <div className="flex flex-wrap gap-2">
              {flipyOperationLink && showBidsEmbed ? (
                <a
                  href={flipyOperationLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex h-9 items-center justify-center rounded-md bg-brand-primary px-4 text-sm font-medium text-white hover:bg-brand-primary/90"
                >
                  Abrir en Flipy (pujas)
                </a>
              ) : null}
              {result.trackingUrl ? (
                <a
                  href={result.trackingUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex h-9 items-center justify-center rounded-md bg-brand-primary px-4 text-sm font-medium text-white hover:bg-brand-primary/90"
                >
                  Abrir rastreo Flipy
                </a>
              ) : null}
              {result.trackingUrl ? (
                <Button
                  variant="outline"
                  onClick={() => {
                    void navigator.clipboard.writeText(result.trackingUrl!);
                  }}
                >
                  Copiar link rastreo
                </Button>
              ) : null}
              <Button variant="secondary" onClick={() => closeModal(false)}>
                Cerrar
              </Button>
            </div>
          </div>
        ) : null}
      </div>

      <FlipyRouteAddressModal
        open={routeModal === "pickup"}
        onOpenChange={(next) => setRouteModal(next ? "pickup" : null)}
        kind="pickup"
        agencySlug={agencySlug}
        storeSlug={storeSlug}
        orderId={orderId}
        embedOrigin={embedOrigin}
        value={pickupPoint}
        storeOrigin={storeOrigin}
        defaultContactName={storeOrigin?.contactName ?? customerName}
        defaultContactPhone={storeOrigin?.phone ?? customerPhone}
        prefetchedEmbed={mapEmbedPrefetch.pickup}
        onSave={(point) => {
          setPickupPoint(point);
          setPickupCardError(null);
          setError(null);
        }}
      />

      <FlipyRouteAddressModal
        open={routeModal === "delivery"}
        onOpenChange={(next) => setRouteModal(next ? "delivery" : null)}
        kind="delivery"
        agencySlug={agencySlug}
        storeSlug={storeSlug}
        orderId={orderId}
        embedOrigin={embedOrigin}
        value={deliveryPoint}
        mapPrefillAddress={prefillAddress}
        mapPrefillCoords={prefillCoords}
        defaultContactName={customerName}
        defaultContactPhone={customerPhone}
        defaultContactEmail={customerEmail}
        prefetchedEmbed={mapEmbedPrefetch.delivery}
        onSave={(point) => {
          setDeliveryPoint(point);
          setDeliveryCardError(null);
          setError(null);
        }}
      />
    </Dialog>
  );
}
