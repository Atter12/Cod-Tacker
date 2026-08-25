"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import {
  cotizarFlipyFlete,
  createFlipyShipmentFromOrder,
} from "@/app/actions/flipy-shipments";
import { issueFlipyWidgetTokenAction } from "@/app/actions/flipy-widgets";
import { FlipyBidsEmbed } from "@/components/flipy/FlipyBidsEmbed";
import { FlipyLocationEmbed } from "@/components/flipy/FlipyLocationEmbed";
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

type Destination = { address: string; lat: number; lng: number };

export type FlipyStoreOriginDefaults = {
  address: string;
  lat: number;
  lng: number;
  contactName: string;
  phone: string;
};

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

function peMobileDigits(value: string): string {
  return value.replace(/\D/g, "").slice(-9);
}

function isValidPeMobile(value: string): boolean {
  const digits = peMobileDigits(value);
  return digits.length === 9 && digits.startsWith("9");
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
  const [escenario, setEscenario] = useState<FlipyEscenarioPago>(() =>
    initialFlipyEscenarioForUi(paymentResolution),
  );

  const [originAddress, setOriginAddress] = useState(storeOrigin?.address ?? "");
  const [originLat, setOriginLat] = useState(storeOrigin?.lat ?? NaN);
  const [originLng, setOriginLng] = useState(storeOrigin?.lng ?? NaN);
  const [originContactName, setOriginContactName] = useState(storeOrigin?.contactName ?? "");
  const [originPhone, setOriginPhone] = useState(storeOrigin?.phone ?? "");

  const [destination, setDestination] = useState<Destination | null>(null);
  const [destContactName, setDestContactName] = useState(customerName ?? "");
  const [destPhone, setDestPhone] = useState(customerPhone ?? "");
  const [destEmail, setDestEmail] = useState(customerEmail ?? "");
  const [pickupEmbedUrl, setPickupEmbedUrl] = useState<string | null>(null);
  const [deliveryEmbedUrl, setDeliveryEmbedUrl] = useState<string | null>(null);
  const [resolvedEmbedOrigin, setResolvedEmbedOrigin] = useState(embedOrigin);
  const [originPinConfirmed, setOriginPinConfirmed] = useState(false);
  const [pickupMapNonce, setPickupMapNonce] = useState(0);

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
    if (!destination) return null;
    return evaluateDestinationConsistency({
      address: destination.address,
      lat: destination.lat,
      lng: destination.lng,
      prefillAddress,
      prefillCoords,
    });
  }, [destination, prefillAddress, prefillCoords]);

  const coordsReady =
    Number.isFinite(originLat) &&
    Number.isFinite(originLng) &&
    destination != null &&
    Number.isFinite(destination.lat) &&
    Number.isFinite(destination.lng);

  const requestQuote = useCallback(() => {
    if (!coordsReady || !destination) return;
    const requestId = ++quoteRequestIdRef.current;
    setQuoting(true);
    setQuoteError(null);
    startTransition(async () => {
      const quoted = await cotizarFlipyFlete({
        agencySlug,
        storeSlug,
        originLat,
        originLng,
        destinationLat: destination.lat,
        destinationLng: destination.lng,
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
    destination,
    originLat,
    originLng,
    packageSize,
    fleteLocked,
    fletePrice,
    escenario,
    paymentResolution.suggestedFlete,
    smartEligible,
  ]);

  useEffect(() => {
    if (!open || step !== "ruta" || !coordsReady) return;
    const timer = window.setTimeout(() => requestQuote(), QUOTE_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [open, step, coordsReady, originLat, originLng, destination, packageSize, requestQuote]);

  function applyStoreOrigin() {
    if (!storeOrigin) {
      setError("No hay origen de tienda Flipy configurado. Reconecta la integración con dirección completa.");
      return;
    }
    setError(null);
    setOriginAddress(storeOrigin.address);
    setOriginLat(storeOrigin.lat);
    setOriginLng(storeOrigin.lng);
    setOriginContactName(storeOrigin.contactName);
    setOriginPhone(storeOrigin.phone);
    setOriginPinConfirmed(true);
    setPickupEmbedUrl(null);
    startTransition(async () => {
      const tokenResult = await issueFlipyWidgetTokenAction({
        agencySlug,
        storeSlug,
        orderId,
        prefillAddress: storeOrigin.address,
        prefillLat: storeOrigin.lat,
        prefillLng: storeOrigin.lng,
      });
      if (tokenResult.error || !tokenResult.embedUrl) {
        setError(
          tokenResult.error ??
            "Dirección de tienda aplicada en el formulario, pero no se pudo recargar el mapa.",
        );
        return;
      }
      setPickupEmbedUrl(tokenResult.embedUrl);
      setResolvedEmbedOrigin(tokenResult.embedOrigin ?? embedOrigin);
      setPickupMapNonce((n) => n + 1);
    });
  }

  function applyStoreContact() {
    if (!storeOrigin) {
      setError("No hay datos de contacto de tienda Flipy.");
      return;
    }
    setOriginContactName(storeOrigin.contactName);
    setOriginPhone(storeOrigin.phone);
    setError(null);
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
    setDestination(null);
    setPickupEmbedUrl(null);
    setDeliveryEmbedUrl(null);
    setResolvedEmbedOrigin(embedOrigin);
    setOriginPinConfirmed(false);
    setPickupMapNonce(0);
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
    setOriginAddress(storeOrigin?.address ?? "");
    setOriginLat(storeOrigin?.lat ?? NaN);
    setOriginLng(storeOrigin?.lng ?? NaN);
    setOriginContactName(storeOrigin?.contactName ?? "");
    setOriginPhone(storeOrigin?.phone ?? "");
    setDestContactName(customerName ?? "");
    setDestPhone(customerPhone ?? "");
    setDestEmail(customerEmail ?? "");
  }

  function closeModal(nextOpen: boolean) {
    if (!nextOpen) resetFlow();
    onOpenChange(nextOpen);
  }

  function validateRuta(): string | null {
    if (!originAddress.trim()) return "Confirma o edita la dirección de recojo en el mapa.";
    if (!Number.isFinite(originLat) || !Number.isFinite(originLng)) {
      return "Confirma el pin de recojo en el mapa Flipy (o usa la dirección de tu tienda).";
    }
    if (!originPinConfirmed) {
      return "Confirma el pin de recojo en el mapa (o pulsa “Usar dirección de mi tienda”).";
    }
    if (!originContactName.trim()) return "Indica quién entrega (nombre).";
    if (!isValidPeMobile(originPhone)) {
      return "Celular de quién entrega: 9 dígitos PE (empieza en 9).";
    }
    if (!destination) return "Confirma la ubicación de entrega en el mapa Flipy.";
    if (!destination.address.trim()) return "La dirección de entrega está vacía — edítala.";
    if (destinationConsistency && !destinationConsistency.ok) {
      return "La dirección textual no coincide con el pin. Corrígela antes de continuar.";
    }
    if (!destContactName.trim()) return "Indica quién recibe (nombre).";
    if (!isValidPeMobile(destPhone)) {
      return "Celular de quién recibe: 9 dígitos PE (empieza en 9).";
    }
    if (!fleteValidation.ok) return fleteValidation.error ?? "Revisa el flete.";
    return null;
  }

  function loadRutaEmbeds() {
    setError(null);
    if (smartEligible) setEscenario("1A");
    startTransition(async () => {
      const [pickupToken, deliveryToken] = await Promise.all([
        issueFlipyWidgetTokenAction({
          agencySlug,
          storeSlug,
          orderId,
          prefillAddress: storeOrigin?.address || originAddress || null,
          prefillLat: storeOrigin?.lat ?? (Number.isFinite(originLat) ? originLat : null),
          prefillLng: storeOrigin?.lng ?? (Number.isFinite(originLng) ? originLng : null),
        }),
        issueFlipyWidgetTokenAction({
          agencySlug,
          storeSlug,
          orderId,
          prefillAddress,
          prefillLat: prefillCoords?.lat,
          prefillLng: prefillCoords?.lng,
        }),
      ]);

      if (pickupToken.error || !pickupToken.embedUrl) {
        setError(pickupToken.error ?? "No se pudo cargar el mapa de recojo Flipy.");
        return;
      }
      if (deliveryToken.error || !deliveryToken.embedUrl) {
        setError(deliveryToken.error ?? "No se pudo cargar el mapa de entrega Flipy.");
        return;
      }

      setPickupEmbedUrl(pickupToken.embedUrl);
      setDeliveryEmbedUrl(deliveryToken.embedUrl);
      setResolvedEmbedOrigin(pickupToken.embedOrigin ?? deliveryToken.embedOrigin ?? embedOrigin);
      setStep("ruta");
    });
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
    loadRutaEmbeds();
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
    const rutaError = validateRuta();
    if (rutaError) {
      setError(rutaError);
      return;
    }
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
    if (!destination || !fleteValidation.ok || fleteValidation.value == null) {
      setError(fleteValidation.error ?? "Revisa la oferta de flete.");
      setStep("ruta");
      return;
    }
    setError(null);
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
        destinationEmail: destEmail.trim() || null,
        smartEligible,
        origin: {
          address: originAddress.trim(),
          lat: originLat,
          lng: originLng,
          contactName: originContactName.trim(),
          phone: peMobileDigits(originPhone),
        },
        destinationContact: {
          name: destContactName.trim(),
          phone: peMobileDigits(destPhone),
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
              <Button disabled={pending} onClick={() => loadRutaEmbeds()}>
                {pending ? "Cargando mapas…" : "Siguiente: ruta"}
              </Button>
            </div>
          </div>
        ) : null}

        {step === "ruta" ? (
          <div className="space-y-4">
            {smartEligible ? (
              <Alert variant="info" title="Asignación automática (1A)">
                Flete prepagado en Shopify — modalidad 1A aplicada. El flete se fija con la cotización
                Flipy.
              </Alert>
            ) : null}

            <div className="space-y-3 rounded-lg border border-border p-3">
              <h3 className="text-sm font-semibold">Recojo</h3>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="outline" type="button" onClick={applyStoreOrigin} disabled={!storeOrigin}>
                  Usar dirección de mi tienda
                </Button>
                <Button size="sm" variant="outline" type="button" onClick={applyStoreContact} disabled={!storeOrigin}>
                  Usar datos de mi tienda
                </Button>
              </div>
              {pickupEmbedUrl ? (
                <FlipyLocationEmbed
                  key={`pickup-map-${pickupMapNonce}`}
                  embedUrl={pickupEmbedUrl}
                  embedOrigin={resolvedEmbedOrigin}
                  agencySlug={agencySlug}
                  storeSlug={storeSlug}
                  purpose="pickup"
                  prefillAddress={storeOrigin?.address || originAddress || null}
                  prefillCoords={
                    storeOrigin
                      ? { lat: storeOrigin.lat, lng: storeOrigin.lng }
                      : Number.isFinite(originLat) && Number.isFinite(originLng)
                        ? { lat: originLat, lng: originLng }
                        : null
                  }
                  mapHeightClassName="h-[min(48vh,420px)]"
                  onConfirmed={(next) => {
                    setOriginAddress(next.address);
                    setOriginLat(next.lat);
                    setOriginLng(next.lng);
                    setOriginPinConfirmed(true);
                    setError(null);
                  }}
                />
              ) : (
                <p className="text-xs text-text-secondary">{pending ? "Cargando mapa de recojo…" : "Mapa de recojo pendiente."}</p>
              )}
              <div className="grid gap-3 sm:grid-cols-2">
                <FormField label="Quién entrega — nombre" htmlFor="flipy-origin-name">
                  <Input
                    id="flipy-origin-name"
                    value={originContactName}
                    onChange={(e) => setOriginContactName(e.target.value)}
                  />
                </FormField>
                <FormField label="Quién entrega — celular (9 dígitos)" htmlFor="flipy-origin-phone">
                  <Input
                    id="flipy-origin-phone"
                    inputMode="tel"
                    value={originPhone}
                    onChange={(e) => setOriginPhone(e.target.value)}
                    placeholder="9XXXXXXXX"
                  />
                </FormField>
              </div>
            </div>

            <div className="space-y-3 rounded-lg border border-border p-3">
              <h3 className="text-sm font-semibold">Entrega</h3>
              {deliveryEmbedUrl ? (
                <FlipyLocationEmbed
                  embedUrl={deliveryEmbedUrl}
                  embedOrigin={resolvedEmbedOrigin}
                  agencySlug={agencySlug}
                  storeSlug={storeSlug}
                  purpose="delivery"
                  prefillAddress={prefillAddress}
                  prefillCoords={prefillCoords}
                  mapHeightClassName="h-[min(48vh,420px)]"
                  onConfirmed={(next) => {
                    setDestination(next);
                    setError(null);
                  }}
                />
              ) : (
                <p className="text-xs text-text-secondary">{pending ? "Cargando mapa de entrega…" : "Mapa de entrega pendiente."}</p>
              )}
              <div className="grid gap-3 sm:grid-cols-2">
                <FormField label="Quién recibe — nombre" htmlFor="flipy-dest-name">
                  <Input
                    id="flipy-dest-name"
                    value={destContactName}
                    onChange={(e) => setDestContactName(e.target.value)}
                  />
                </FormField>
                <FormField label="Quién recibe — celular (9 dígitos)" htmlFor="flipy-dest-phone">
                  <Input
                    id="flipy-dest-phone"
                    inputMode="tel"
                    value={destPhone}
                    onChange={(e) => setDestPhone(e.target.value)}
                    placeholder="9XXXXXXXX"
                  />
                </FormField>
              </div>
              <FormField label="Email (opcional)" htmlFor="flipy-dest-email">
                <Input
                  id="flipy-dest-email"
                  type="email"
                  value={destEmail}
                  onChange={(e) => setDestEmail(e.target.value)}
                />
              </FormField>
            </div>

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
                <p className="text-xs text-text-secondary">Confirma recojo y entrega para cotizar.</p>
              ) : null}
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
              <Button
                disabled={pending || !pickupEmbedUrl || !deliveryEmbedUrl || !fleteValidation.ok}
                onClick={() => goConfirm()}
              >
                Siguiente: confirmar
              </Button>
            </div>
          </div>
        ) : null}

        {step === "confirm" && destination ? (
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
                <dd>{originAddress}</dd>
                <dd className="text-xs text-text-secondary">
                  {originContactName} · {peMobileDigits(originPhone)} ·{" "}
                  {formatCoordsLabel(originLat, originLng)}
                </dd>
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                <div>
                  <dt className="text-text-secondary">Entrega — dirección</dt>
                  <dd className="font-medium">{destination.address}</dd>
                </div>
                <div>
                  <dt className="text-text-secondary">Entrega — pin</dt>
                  <dd className="font-mono text-xs">
                    {formatCoordsLabel(destination.lat, destination.lng)}
                  </dd>
                </div>
              </div>
              <div>
                <dt className="text-text-secondary">Quién recibe</dt>
                <dd>
                  {destContactName} · {peMobileDigits(destPhone)}
                  {destEmail ? ` · ${destEmail}` : ""}
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
    </Dialog>
  );
}
