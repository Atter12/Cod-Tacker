"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import {
  createFlipyShipmentFromOrder,
  geocodeFlipyDeliveryAddress,
} from "@/app/actions/flipy-shipments";
import {
  fetchFlipyWalletSaldo,
  transferFlipyGananciasToOperaciones,
} from "@/app/actions/flipy-wallet";
import { issueFlipyWidgetTokenAction } from "@/app/actions/flipy-widgets";
import { FlipyBidsEmbed } from "@/components/flipy/FlipyBidsEmbed";
import { FlipyConfirmStepPanel } from "@/components/flipy/FlipyConfirmStepPanel";
import { FlipyEscenarioLabel } from "@/components/flipy/FlipyEscenarioLabel";
import { FlipyPaymentStepPanel } from "@/components/flipy/FlipyPaymentStepPanel";
import { FlipyRutaStepPanel } from "@/components/flipy/FlipyRutaStepPanel";
import { FlipyWizardFooter } from "@/components/flipy/FlipyWizardFooter";
import { mapFlipyWizardStep } from "@/components/flipy/FlipyWizardStepper";
import {
  FlipyRouteAddressModal,
  buildMapPrefillKey,
  resolveMapPrefill,
  type FlipyMapEmbedPrefetch,
} from "@/components/flipy/FlipyRouteAddressModal";
import { FlipyWalletEmbed } from "@/components/flipy/FlipyWalletEmbed";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { formatCurrency } from "@/lib/formatting/currency";
import {
  evaluateDestinationConsistency,
} from "@/lib/integrations/flipy/destination-consistency";
import { FLIPY_ERROR_CODES } from "@/lib/integrations/flipy/errors";
import { buildFlipyOperationDeepLink } from "@/lib/integrations/flipy/embed-urls";
import {
  initialFleteInputValue,
  isFlipyFleteLocked,
  validateFlipyFletePrice,
} from "@/lib/integrations/flipy/flete-rules";
import {
  buildFlipyShopifyPaymentSummary,
  deriveCodAmountFromD3,
  flipyEscenarioOptionsForUi,
  initialFlipyEscenarioForUi,
  shouldSkipFlipyCodPaymentStep,
  FLIPY_YAPE_COD_TOPE,
} from "@/lib/integrations/flipy/labels";
import type { FlipyPackageCareId } from "@/lib/integrations/flipy/map-package-care";
import type { FlipyPackageSize } from "@/lib/integrations/flipy/map-package-size";
import type { FlipyFleteQuote, FlipyTypeMode } from "@/lib/integrations/flipy/partner-contract";
import { fetchFlipyCotizar } from "@/lib/integrations/flipy/fetch-cotizar-client";
import {
  buildFlipyRouteKey,
  canRecalcFleteLocally,
  isUsableFlipyFleteDistance,
  recalcFleteFromDistance,
  type FlipyFleteQuoteSource,
} from "@/lib/integrations/flipy/flete-quote-local";
import {
  emptyFlipyRoutePoint,
  hasFlipyRouteLocation,
  peMobileDigits,
  validateFlipyRoutePoint,
  type FlipyRoutePoint,
  type FlipyStoreOriginDefaults,
} from "@/lib/integrations/flipy/route-address";
import type { FlipyEscenarioPago, FlipyPaymentResolution } from "@/lib/integrations/flipy/resolve-payment";
import {
  applyGeocodedShopifyDelivery,
  resolveShopifyDeliveryPoint,
} from "@/lib/integrations/flipy/shopify-delivery";

export type { FlipyStoreOriginDefaults };

type Props = {
  agencySlug: string;
  storeSlug: string;
  orderId: string;
  orderNumber: string;
  currencyCode: string;
  prefillAddress: string;
  prefillCoords?: { lat: number; lng: number } | null;
  shippingAddress1?: string | null;
  shippingCountryCode?: string | null;
  shippingCity?: string | null;
  shippingRegion?: string | null;
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

type WalletSaldoSnapshot = {
  billeteraOperaciones: number;
  billeteraGanancias: number;
  transferGananciasDisponible: boolean;
};

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
const QUOTE_PREFETCH_DEBOUNCE_MS = 300;
const FLIPY_TYPE_MODE: FlipyTypeMode = "express";

type QuoteCache = {
  routeKey: string;
  fleteQuote: FlipyFleteQuote;
};

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

function buildShopifyDeliveryInput(input: {
  prefillAddress: string;
  prefillCoords?: { lat: number; lng: number } | null;
  shippingAddress1?: string | null;
  shippingCountryCode?: string | null;
  shippingCity?: string | null;
  shippingRegion?: string | null;
  customerName?: string | null;
  customerPhone?: string | null;
  customerEmail?: string | null;
}) {
  return {
    prefillAddress: input.prefillAddress,
    prefillCoords: input.prefillCoords,
    shippingAddress1: input.shippingAddress1,
    shippingCountryCode: input.shippingCountryCode,
    shippingCity: input.shippingCity,
    shippingRegion: input.shippingRegion,
    customerName: input.customerName,
    customerPhone: input.customerPhone,
    customerEmail: input.customerEmail,
  };
}

function buildInitialDelivery(input: {
  prefillAddress: string;
  prefillCoords?: { lat: number; lng: number } | null;
  shippingAddress1?: string | null;
  shippingCountryCode?: string | null;
  shippingCity?: string | null;
  shippingRegion?: string | null;
  customerName?: string | null;
  customerPhone?: string | null;
  customerEmail?: string | null;
}): FlipyRoutePoint {
  return resolveShopifyDeliveryPoint(buildShopifyDeliveryInput(input)).point;
}

function isSmartFallback(result: CreateResult, smartEligible: boolean): boolean {
  return (
    smartEligible &&
    result.fulfillmentMode === "bid" &&
    result.estado === "PENDIENTE_PUJAS"
  );
}

function wizardHeadline(step: Step): string {
  switch (step) {
    case "payment":
      return "Modalidad de pago en destino";
    case "ruta":
      return "Ruta y detalles del paquete";
    case "confirm":
      return "Revisa y confirma el envío";
    case "recarga":
      return "Recargar billetera Flipy";
    case "success":
      return "Envío creado en Flipy";
  }
}

function formatOrderLabel(orderNumber: string): string {
  const trimmed = orderNumber.trim();
  return trimmed.startsWith("#") ? trimmed : `#${trimmed}`;
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
  shippingAddress1 = null,
  shippingCountryCode = null,
  shippingCity = null,
  shippingRegion = null,
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
  const shopifyDeliveryInput = useMemo(
    () =>
      buildShopifyDeliveryInput({
        prefillAddress,
        prefillCoords,
        shippingAddress1,
        shippingCountryCode,
        shippingCity,
        shippingRegion,
        customerName,
        customerPhone,
        customerEmail,
      }),
    [
      prefillAddress,
      prefillCoords,
      shippingAddress1,
      shippingCountryCode,
      shippingCity,
      shippingRegion,
      customerName,
      customerPhone,
      customerEmail,
    ],
  );
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
  const shopifyPaymentSummary = useMemo(
    () =>
      buildFlipyShopifyPaymentSummary(paymentResolution, (value) =>
        formatCurrency(value, currencyCode),
      ),
    [paymentResolution, currencyCode],
  );
  const skippedSmartPaymentRef = useRef(false);
  const quoteRequestIdRef = useRef(0);
  const quoteCacheRef = useRef<QuoteCache | null>(null);
  const quoteAbortRef = useRef<AbortController | null>(null);
  const prefetchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** User chose +/- or a suggestion — don't clobber offer on package-size recalc. */
  const fletePriceTouchedRef = useRef(false);
  /** Route key for which we last auto-filled recommended fare. */
  const appliedPriceRouteKeyRef = useRef<string | null>(null);

  const [step, setStep] = useState<Step>("payment");
  const [error, setError] = useState<string | null>(null);
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const [walletEmbedUrl, setWalletEmbedUrl] = useState<string | null>(null);
  const [walletSaldo, setWalletSaldo] = useState<WalletSaldoSnapshot | null>(null);
  const [walletSaldoLoading, setWalletSaldoLoading] = useState(false);
  const [walletTransferMessage, setWalletTransferMessage] = useState<string | null>(null);
  const transferIdempotencyRef = useRef<string | null>(null);
  const [resolvedEmbedOrigin, setResolvedEmbedOrigin] = useState(embedOrigin);
  const [escenario, setEscenario] = useState<FlipyEscenarioPago>(() =>
    initialFlipyEscenarioForUi(paymentResolution),
  );
  const codAmountForEscenario = useMemo(
    () => deriveCodAmountFromD3(escenario, paymentResolution),
    [escenario, paymentResolution],
  );

  const [pickupPoint, setPickupPoint] = useState<FlipyRoutePoint>(() =>
    buildInitialPickup(storeOrigin),
  );
  const [deliveryPoint, setDeliveryPoint] = useState<FlipyRoutePoint>(() =>
    buildInitialDelivery(shopifyDeliveryInput),
  );
  const [shopifyDeliveryHint, setShopifyDeliveryHint] = useState<string | null>(null);
  const [geocodingShopifyDelivery, setGeocodingShopifyDelivery] = useState(false);
  const geocodeAttemptRef = useRef<string | null>(null);
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
  const [termsAccepted, setTermsAccepted] = useState(false);

  const [result, setResult] = useState<CreateResult | null>(null);

  const fleteLocked = isFlipyFleteLocked(fleteContext);
  const fleteValidation = useMemo(
    () => validateFlipyFletePrice(escenario, fletePrice, { ...fleteContext, fleteQuote }),
    [escenario, fletePrice, fleteContext, fleteQuote],
  );

  const destinoCobroSummary = useMemo(() => {
    const parts: number[] = [];
    if (codAmountForEscenario != null && codAmountForEscenario > 0) {
      parts.push(codAmountForEscenario);
    }
    if (
      !paymentResolution.shippingPaidAtCheckout &&
      fleteValidation.value != null &&
      fleteValidation.value > 0
    ) {
      parts.push(fleteValidation.value);
    }
    if (parts.length === 0) return "Nada";
    const total = parts.reduce((sum, value) => sum + value, 0);
    return formatCurrency(total, currencyCode);
  }, [
    codAmountForEscenario,
    paymentResolution.shippingPaidAtCheckout,
    fleteValidation.value,
    currencyCode,
  ]);

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

  const routeKey = useMemo(() => {
    if (!coordsReady) return null;
    return buildFlipyRouteKey({
      originLat: pickupPoint.lat,
      originLng: pickupPoint.lng,
      destinationLat: deliveryPoint.lat,
      destinationLng: deliveryPoint.lng,
    });
  }, [coordsReady, pickupPoint.lat, pickupPoint.lng, deliveryPoint.lat, deliveryPoint.lng]);

  const applyQuoteResult = useCallback(
    (quote: FlipyFleteQuote, nextRouteKey: string) => {
      if (!isUsableFlipyFleteDistance(quote.distanceKm)) {
        // Cache route attempt to avoid refetch loops; do not publish quote to UI.
        quoteCacheRef.current = { routeKey: nextRouteKey, fleteQuote: quote };
        setQuoteError("Confirma recojo y entrega para cotizar el flete.");
        return;
      }

      quoteCacheRef.current = { routeKey: nextRouteKey, fleteQuote: quote };
      setFleteQuote(quote);
      setQuoteError(null);

      const routeChanged = appliedPriceRouteKeyRef.current !== nextRouteKey;
      if (routeChanged) {
        fletePriceTouchedRef.current = false;
      }

      const shouldSyncPrice = fleteLocked || !fletePriceTouchedRef.current || routeChanged;
      if (shouldSyncPrice && quote.recommendedFare != null && Number.isFinite(quote.recommendedFare)) {
        setFletePrice(String(quote.recommendedFare));
        appliedPriceRouteKeyRef.current = nextRouteKey;
      }
    },
    [fleteLocked],
  );

  const handleFletePriceChange = useCallback((value: string) => {
    fletePriceTouchedRef.current = true;
    setFletePrice(value);
  }, []);

  const readQuoteSource = useCallback((quote: FlipyFleteQuote): FlipyFleteQuoteSource => {
    if (quote.source === "haversine" || quote.source === "directions") {
      return quote.source;
    }
    return "directions";
  }, []);

  const requestRemoteQuote = useCallback(
    (
      nextRouteKey: string,
      coords: {
        originLat: number;
        originLng: number;
        destinationLat: number;
        destinationLng: number;
      },
    ) => {
      quoteAbortRef.current?.abort();
      const abort = new AbortController();
      quoteAbortRef.current = abort;
      const requestId = ++quoteRequestIdRef.current;
      setQuoting(true);
      setQuoteError(null);

      void fetchFlipyCotizar(
        {
          agencySlug,
          storeSlug,
          originLat: coords.originLat,
          originLng: coords.originLng,
          destinationLat: coords.destinationLat,
          destinationLng: coords.destinationLng,
          packageSize,
          typeMode: FLIPY_TYPE_MODE,
        },
        abort.signal,
      ).then((result) => {
        if (requestId !== quoteRequestIdRef.current) return;
        if (abort.signal.aborted) return;
        setQuoting(false);
        if (result.error || !result.fleteQuote) {
          setQuoteError(result.error ?? "No se pudo cotizar el flete.");
          setFleteQuote(null);
          return;
        }
        applyQuoteResult(result.fleteQuote, nextRouteKey);
      });
    },
    [agencySlug, storeSlug, packageSize, applyQuoteResult],
  );

  const schedulePrefetchQuote = useCallback(
    (coords: {
      originLat: number;
      originLng: number;
      destinationLat: number;
      destinationLng: number;
    }) => {
      if (prefetchDebounceRef.current) clearTimeout(prefetchDebounceRef.current);
      prefetchDebounceRef.current = setTimeout(() => {
        const coordsValid = [
          coords.originLat,
          coords.originLng,
          coords.destinationLat,
          coords.destinationLng,
        ].every((value) => Number.isFinite(value));
        if (!coordsValid) return;

        const nextRouteKey = buildFlipyRouteKey(coords);
        if (quoteCacheRef.current?.routeKey === nextRouteKey) return;
        requestRemoteQuote(nextRouteKey, coords);
      }, QUOTE_PREFETCH_DEBOUNCE_MS);
    },
    [requestRemoteQuote],
  );

  const handleLivePinCoords = useCallback(
    (coords: { lat: number; lng: number }, kind: "pickup" | "delivery") => {
      if (!Number.isFinite(coords.lat) || !Number.isFinite(coords.lng)) return;
      if (kind === "delivery" && hasFlipyRouteLocation(pickupPoint)) {
        schedulePrefetchQuote({
          originLat: pickupPoint.lat,
          originLng: pickupPoint.lng,
          destinationLat: coords.lat,
          destinationLng: coords.lng,
        });
      } else if (kind === "pickup" && hasFlipyRouteLocation(deliveryPoint)) {
        schedulePrefetchQuote({
          originLat: coords.lat,
          originLng: coords.lng,
          destinationLat: deliveryPoint.lat,
          destinationLng: deliveryPoint.lng,
        });
      }
    },
    [
      pickupPoint.lat,
      pickupPoint.lng,
      deliveryPoint.lat,
      deliveryPoint.lng,
      schedulePrefetchQuote,
    ],
  );

  useEffect(() => {
    if (!open || step !== "ruta" || !routeKey || !coordsReady) return;

    const cached = quoteCacheRef.current;
    if (cached?.routeKey === routeKey && canRecalcFleteLocally(cached.fleteQuote)) {
      quoteAbortRef.current?.abort();
      setQuoting(false);
      const quote = recalcFleteFromDistance(
        cached.fleteQuote.distanceKm!,
        packageSize,
        FLIPY_TYPE_MODE,
        readQuoteSource(cached.fleteQuote),
        { durationMinutes: cached.fleteQuote.durationMinutes },
      );
      applyQuoteResult(quote, routeKey);
      return;
    }

    if (cached?.routeKey === routeKey && cached.fleteQuote) {
      if (!isUsableFlipyFleteDistance(cached.fleteQuote.distanceKm)) {
        setQuoting(false);
        setQuoteError("Confirma recojo y entrega para cotizar el flete.");
        return;
      }
      applyQuoteResult(cached.fleteQuote, routeKey);
      return;
    }

    requestRemoteQuote(routeKey, {
      originLat: pickupPoint.lat,
      originLng: pickupPoint.lng,
      destinationLat: deliveryPoint.lat,
      destinationLng: deliveryPoint.lng,
    });
  }, [
    open,
    step,
    routeKey,
    packageSize,
    coordsReady,
    pickupPoint.lat,
    pickupPoint.lng,
    deliveryPoint.lat,
    deliveryPoint.lng,
    applyQuoteResult,
    readQuoteSource,
    requestRemoteQuote,
  ]);

  useEffect(() => {
    return () => {
      quoteAbortRef.current?.abort();
      if (prefetchDebounceRef.current) clearTimeout(prefetchDebounceRef.current);
    };
  }, []);

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
    const pickupKey = buildMapPrefillKey(pickupPrefill);
    const deliveryKey = buildMapPrefillKey(deliveryPrefill);

    if (
      mapEmbedPrefetch.pickup?.prefillKey === pickupKey &&
      mapEmbedPrefetch.delivery?.prefillKey === deliveryKey
    ) {
      return;
    }

    void (async () => {
      const pickupToken = await issueFlipyWidgetTokenAction({
        agencySlug,
        storeSlug,
        orderId,
        prefillAddress: pickupPrefill.address,
        prefillLat: pickupPrefill.lat ?? undefined,
        prefillLng: pickupPrefill.lng ?? undefined,
      });
      if (cancelled) return;

      setMapEmbedPrefetch((prev) => ({
        ...prev,
        pickup:
          pickupToken.embedUrl
            ? {
                embedUrl: pickupToken.embedUrl,
                embedOrigin: pickupToken.embedOrigin ?? embedOrigin,
                prefillKey: pickupKey,
              }
            : null,
      }));

      const deliveryToken = await issueFlipyWidgetTokenAction({
        agencySlug,
        storeSlug,
        orderId,
        prefillAddress: deliveryPrefill.address,
        prefillLat: deliveryPrefill.lat ?? undefined,
        prefillLng: deliveryPrefill.lng ?? undefined,
      });
      if (cancelled) return;

      setMapEmbedPrefetch({
        pickup:
          pickupToken.embedUrl
            ? {
                embedUrl: pickupToken.embedUrl,
                embedOrigin: pickupToken.embedOrigin ?? embedOrigin,
                prefillKey: pickupKey,
              }
            : null,
        delivery:
          deliveryToken.embedUrl
            ? {
                embedUrl: deliveryToken.embedUrl,
                embedOrigin: deliveryToken.embedOrigin ?? embedOrigin,
                prefillKey: deliveryKey,
              }
            : null,
      });
    })();

    return () => {
      cancelled = true;
    };
    // Prefetch only when coords change — not on every reverse-geocode address string.
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
    pickupPoint.lat,
    pickupPoint.lng,
    deliveryPoint.lat,
    deliveryPoint.lng,
    mapEmbedPrefetch.pickup?.prefillKey,
    mapEmbedPrefetch.delivery?.prefillKey,
  ]);

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
    quoteCacheRef.current = null;
    quoteAbortRef.current?.abort();
    quoteAbortRef.current = null;
    if (prefetchDebounceRef.current) clearTimeout(prefetchDebounceRef.current);
    prefetchDebounceRef.current = null;
    setStep("payment");
    setError(null);
    setErrorCode(null);
    setWalletEmbedUrl(null);
    setWalletSaldo(null);
    setWalletSaldoLoading(false);
    setWalletTransferMessage(null);
    transferIdempotencyRef.current = null;
    setPickupPoint(buildInitialPickup(storeOrigin));
    const resolvedDelivery = resolveShopifyDeliveryPoint(shopifyDeliveryInput);
    setDeliveryPoint(resolvedDelivery.point);
    setShopifyDeliveryHint(resolvedDelivery.hint);
    setGeocodingShopifyDelivery(false);
    geocodeAttemptRef.current = null;
    setRouteModal(null);
    setPickupCardError(null);
    setDeliveryCardError(null);
    setResolvedEmbedOrigin(embedOrigin);
    setResult(null);
    setNotes("");
    setTermsAccepted(false);
    setPackageSize(defaultPackageSize);
    setPackageCare(defaultPackageCare);
    setPackageCareNote("");
    setFleteQuote(null);
    setQuoting(false);
    setQuoteError(null);
    quoteCacheRef.current = null;
    fletePriceTouchedRef.current = false;
    appliedPriceRouteKeyRef.current = null;
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
      geocodeAttemptRef.current = null;
      setGeocodingShopifyDelivery(false);
      return;
    }

    const resolved = resolveShopifyDeliveryPoint(shopifyDeliveryInput);
    if (resolved.autoConfirmed) {
      setDeliveryPoint((current) =>
        current.pinConfirmed ? current : resolved.point,
      );
      setShopifyDeliveryHint(resolved.hint);
      return;
    }

    if (!resolved.needsGeocode) {
      setShopifyDeliveryHint(resolved.hint);
      return;
    }

    if (hasFlipyRouteLocation(deliveryPoint)) return;

    const attemptKey = prefillAddress.trim();
    if (!attemptKey || geocodeAttemptRef.current === attemptKey) return;
    geocodeAttemptRef.current = attemptKey;

    let cancelled = false;
    setGeocodingShopifyDelivery(true);
    void (async () => {
      const result = await geocodeFlipyDeliveryAddress({
        agencySlug,
        storeSlug,
        address: prefillAddress,
      });
      if (cancelled) return;
      setGeocodingShopifyDelivery(false);

      if (
        !result.error &&
        typeof result.lat === "number" &&
        typeof result.lng === "number" &&
        typeof result.address === "string"
      ) {
        const applied = applyGeocodedShopifyDelivery({
          point: resolved.point,
          geocoded: {
            address: result.address,
            lat: result.lat,
            lng: result.lng,
          },
          prefillAddress,
        });
        if (applied) {
          setDeliveryPoint(applied.point);
          setShopifyDeliveryHint(applied.hint);
          setDeliveryCardError(null);
          return;
        }
      }

      setShopifyDeliveryHint(
        "No pudimos ubicar la dirección de Shopify automáticamente. Confirma la entrega en el mapa.",
      );
    })();

    return () => {
      cancelled = true;
    };
  }, [
    open,
    shopifyDeliveryInput,
    agencySlug,
    storeSlug,
    prefillAddress,
    deliveryPoint.pinConfirmed,
  ]);

  useEffect(() => {
    if (!open) {
      skippedSmartPaymentRef.current = false;
      return;
    }
    if (!shouldSkipFlipyCodPaymentStep(paymentResolution) || skippedSmartPaymentRef.current) return;
    if (step !== "payment") return;
    skippedSmartPaymentRef.current = true;
    setEscenario("1A");
    setFletePrice(
      initialFleteInputValue("1A", paymentResolution.suggestedFlete, { smartEligible }),
    );
    goToRutaStep();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- one-shot skip on open
  }, [open, paymentResolution]);

  function loadWalletEmbed() {
    setError(null);
    setWalletTransferMessage(null);
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

  function transferGananciasForShipment() {
    if (!walletSaldo || walletSaldo.billeteraGanancias <= 0 || !walletSaldo.transferGananciasDisponible) {
      return;
    }
    if (!transferIdempotencyRef.current) {
      transferIdempotencyRef.current = crypto.randomUUID();
    }
    const monto = walletSaldo.billeteraGanancias;
    setWalletTransferMessage(null);
    startTransition(async () => {
      const result = await transferFlipyGananciasToOperaciones({
        agencySlug,
        storeSlug,
        monto,
        idempotencyKey: transferIdempotencyRef.current,
      });
      if (result.error) {
        setError(result.error);
        setErrorCode(typeof result.errorCode === "string" ? result.errorCode : null);
        return;
      }
      transferIdempotencyRef.current = null;
      setWalletSaldo({
        billeteraOperaciones: result.billeteraOperaciones ?? walletSaldo.billeteraOperaciones,
        billeteraGanancias: result.billeteraGanancias ?? 0,
        transferGananciasDisponible:
          (result.billeteraGanancias ?? 0) > 0 && walletSaldo.transferGananciasDisponible,
      });
      setError(null);
      setErrorCode(null);
      setWalletTransferMessage(
        result.message ??
          `Transferiste ${formatCurrency(monto, "PEN")} a Operaciones. Reintenta crear el envío.`,
      );
      if (step === "recarga") {
        setStep("confirm");
      }
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
        setWalletTransferMessage(null);
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

  const showRecargaCta =
    errorCode === FLIPY_ERROR_CODES.SALDO_INSUFICIENTE_HOLD ||
    (error?.toLowerCase().includes("saldo") ?? false);
  const canTransferGanancias =
    Boolean(walletSaldo?.transferGananciasDisponible) &&
    (walletSaldo?.billeteraGanancias ?? 0) > 0;
  const needsWalletSaldo = showRecargaCta || step === "recarga";

  useEffect(() => {
    if (!open || !needsWalletSaldo) {
      setWalletSaldo(null);
      setWalletSaldoLoading(false);
      return;
    }

    let cancelled = false;
    setWalletSaldoLoading(true);
    void fetchFlipyWalletSaldo({ agencySlug, storeSlug }).then((result) => {
      if (cancelled) return;
      setWalletSaldoLoading(false);
      if (result.error) return;
      setWalletSaldo({
        billeteraOperaciones: result.billeteraOperaciones ?? 0,
        billeteraGanancias: result.billeteraGanancias ?? 0,
        transferGananciasDisponible: Boolean(result.transferGananciasDisponible),
      });
    });

    return () => {
      cancelled = true;
    };
  }, [open, needsWalletSaldo, agencySlug, storeSlug]);
  const flipyOperationLink = result
    ? buildFlipyOperationDeepLink({
        appOrigin,
        envioId: result.envioId,
        appWebUrl: result.appWebUrl,
      })
    : null;
  const smartSuccess = result ? isSmartSuccess(result, smartEligible) : false;
  const smartFallback = result ? isSmartFallback(result, smartEligible) : false;
  const showBidsEmbed = result ? !smartSuccess : false;

  const showModalidadStep = !shouldSkipFlipyCodPaymentStep(paymentResolution);
  const wizardStep = mapFlipyWizardStep(step);
  const wizardEyebrow = step !== "success" && step !== "recarga" ? "CREAR ENVÍO · FLIPY" : undefined;
  const orderLabel = formatOrderLabel(orderNumber);

  const wizardFooter =
    wizardStep && step === "payment"
      ? (
          <FlipyWizardFooter
            activeStep="modalidad"
            showModalidad={showModalidadStep}
            onCancel={() => closeModal(false)}
            primaryLabel="Siguiente: ruta"
            onPrimary={() => goToRutaStep()}
            primaryDisabled={pending}
          />
        )
      : wizardStep && step === "ruta"
        ? (
            <FlipyWizardFooter
              activeStep="ruta"
              showModalidad={showModalidadStep}
              hideStepper
              onCancel={() => closeModal(false)}
              showCancel={false}
              backLinkLabel={smartEligible ? undefined : "Volver a modalidad"}
              onBackLink={smartEligible ? undefined : () => setStep("payment")}
              primaryLabel="Siguiente: confirmación"
              onPrimary={() => goConfirm()}
              primaryDisabled={pending || !fleteValidation.ok}
            />
          )
        : wizardStep && step === "confirm"
          ? (
              <FlipyWizardFooter
                activeStep="confirmacion"
                showModalidad={showModalidadStep}
                variant="confirm"
                onCancel={() => closeModal(false)}
                showCancel={false}
                onBackLink={() => setStep("ruta")}
                primaryLabel={pending ? "Creando…" : "Crear envío en Flipy"}
                onPrimary={() => submitCreate()}
                primaryDisabled={
                  pending ||
                  !termsAccepted ||
                  !fleteValidation.ok ||
                  Boolean(destinationConsistency && !destinationConsistency.ok)
                }
                primaryPending={pending}
              />
            )
          : null;

  return (
    <Dialog
      open={open}
      onOpenChange={closeModal}
      eyebrow={wizardEyebrow}
      title={wizardHeadline(step)}
      headerMeta={
        step !== "success" ? (
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-md bg-muted px-2.5 py-1 text-xs font-medium text-text-secondary">
              Pedido{" "}
              <span className="font-semibold text-text-primary">{orderLabel}</span>
            </span>
            {step === "ruta" || step === "confirm" ? (
              <span className="rounded-md bg-sky-100 px-2.5 py-1 text-xs font-semibold text-sky-800 dark:bg-sky-950 dark:text-sky-300">
                <FlipyEscenarioLabel escenario={escenario} className="font-semibold" />
              </span>
            ) : null}
          </div>
        ) : undefined
      }
      footer={wizardFooter}
      className="max-w-3xl"
    >
      <div className="space-y-4 text-sm">
        {step === "confirm" && hasFlipyRouteLocation(deliveryPoint) ? (
          <FlipyConfirmStepPanel
            showModalidadStep={showModalidadStep}
            smartEligible={smartEligible}
            escenario={escenario}
            pickupPoint={pickupPoint}
            deliveryPoint={deliveryPoint}
            fleteQuote={fleteQuote}
            packageSize={packageSize}
            packageCare={packageCare}
            packageCareNote={packageCareNote}
            driverNotes={notes}
            fleteAmount={fleteValidation.value}
            fleteLocked={fleteLocked}
            codProductAmount={codAmountForEscenario}
            productPaidAtCheckout={paymentResolution.productPaidAtCheckout}
            shippingPaidAtCheckout={paymentResolution.shippingPaidAtCheckout}
            currencyCode={currencyCode}
            termsAccepted={termsAccepted}
            onTermsAcceptedChange={setTermsAccepted}
            termsUrl={`${appOrigin.replace(/\/$/, "")}/terminos`}
            onEditRuta={() => setStep("ruta")}
            onEditModalidad={() => setStep(showModalidadStep ? "payment" : "ruta")}
            destinationInconsistent={Boolean(
              destinationConsistency && !destinationConsistency.ok,
            )}
          />
        ) : null}

        {walletTransferMessage ? (
          <Alert variant="success" title="Billetera actualizada">
            <div className="space-y-2">
              <p>{walletTransferMessage}</p>
              <Button size="sm" disabled={pending} onClick={() => submitCreate()}>
                Reintentar crear envío
              </Button>
            </div>
          </Alert>
        ) : null}

        {error ? (
          <Alert variant="danger" title="Error">
            <div className="space-y-2">
              <p>{error}</p>
              {showRecargaCta ? (
                <div className="space-y-2">
                  {walletSaldoLoading ? (
                    <p className="text-xs text-text-secondary">Consultando billetera Flipy…</p>
                  ) : null}
                  {canTransferGanancias && walletSaldo ? (
                    <p className="text-xs text-text-secondary">
                      Tienes {formatCurrency(walletSaldo.billeteraGanancias, "PEN")} en Ganancias COD.
                      Puedes pasarlas a Operaciones al instante o recargar con tarjeta.
                    </p>
                  ) : null}
                  <div className="flex flex-wrap gap-2">
                    {canTransferGanancias && walletSaldo ? (
                      <Button
                        size="sm"
                        disabled={pending}
                        onClick={() => transferGananciasForShipment()}
                      >
                        {pending
                          ? "Transfiriendo…"
                          : `Pasar ${formatCurrency(walletSaldo.billeteraGanancias, "PEN")} a Operaciones`}
                      </Button>
                    ) : null}
                    <Button size="sm" variant="outline" disabled={pending} onClick={() => loadWalletEmbed()}>
                      Recargar en Flipy
                    </Button>
                  </div>
                </div>
              ) : null}
            </div>
          </Alert>
        ) : null}

        {step === "payment" ? (
          <FlipyPaymentStepPanel
            summary={shopifyPaymentSummary}
            escenarioOptions={escenarioOptions}
            escenario={escenario}
            suggestedEscenario={paymentResolution.suggestedEscenario}
            codAmountForEscenario={codAmountForEscenario}
            yapeTop={FLIPY_YAPE_COD_TOPE}
            onSelectEscenario={(value) => {
              setEscenario(value);
              fletePriceTouchedRef.current = false;
              appliedPriceRouteKeyRef.current = null;
              setFletePrice(
                initialFleteInputValue(value, paymentResolution.suggestedFlete, {
                  smartEligible,
                  fleteQuote,
                }),
              );
            }}
          />
        ) : null}

        {step === "ruta" ? (
          <>
            {geocodingShopifyDelivery ? (
              <Alert variant="info" title="Dirección Shopify">
                Ubicando la dirección de envío desde Shopify…
              </Alert>
            ) : shopifyDeliveryHint ? (
              <Alert
                variant={shopifyDeliveryHint.includes("Confirma") ? "warning" : "info"}
                title="Dirección Shopify"
              >
                {shopifyDeliveryHint}
              </Alert>
            ) : null}
            <FlipyRutaStepPanel
            showModalidadStep={showModalidadStep}
            smartEligible={smartEligible}
            storeOriginAvailable={Boolean(storeOrigin)}
            onApplyStoreOrigin={applyStoreOriginToPickupCard}
            pickupPoint={pickupPoint}
            deliveryPoint={deliveryPoint}
            pickupCardError={pickupCardError}
            deliveryCardError={deliveryCardError}
            onOpenPickup={() => {
              setPickupCardError(null);
              setRouteModal("pickup");
            }}
            onOpenDelivery={() => {
              setDeliveryCardError(null);
              setRouteModal("delivery");
            }}
            fleteQuote={fleteQuote}
            quoting={quoting}
            packageSizes={PACKAGE_SIZES}
            packageSize={packageSize}
            onPackageSizeChange={setPackageSize}
            packageCare={packageCare}
            onTogglePackageCare={togglePackageCare}
            packageCareNote={packageCareNote}
            onPackageCareNoteChange={setPackageCareNote}
            fletePrice={fletePrice}
            onFletePriceChange={handleFletePriceChange}
            fleteLocked={fleteLocked}
            quoteError={quoteError}
            coordsReady={coordsReady}
            fleteValidationError={
              quoting || !coordsReady
                ? null
                : fleteValidation.ok
                  ? null
                  : fleteValidation.error
            }
            driverNotes={notes}
            onDriverNotesChange={setNotes}
            productSummaryLabel={shopifyPaymentSummary.productLabel}
            destinoCobroSummary={destinoCobroSummary}
            fleteAmount={fleteValidation.value}
            currencyCode={currencyCode}
          />
          </>
        ) : null}

        {step === "recarga" && walletEmbedUrl ? (
          <div className="space-y-3">
            {canTransferGanancias && walletSaldo ? (
              <Alert variant="info" title="Alternativa sin tarjeta">
                También puedes transferir{" "}
                {formatCurrency(walletSaldo.billeteraGanancias, "PEN")} de Ganancias a Operaciones.
                <div className="mt-2">
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={pending}
                    onClick={() => transferGananciasForShipment()}
                  >
                    Pasar Ganancias a Operaciones
                  </Button>
                </div>
              </Alert>
            ) : null}
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
        onLiveCoordsChange={(coords) => handleLivePinCoords(coords, "pickup")}
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
        onLiveCoordsChange={(coords) => handleLivePinCoords(coords, "delivery")}
      />
    </Dialog>
  );
}
