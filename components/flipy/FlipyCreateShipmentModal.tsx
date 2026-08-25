"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { createFlipyShipmentFromOrder } from "@/app/actions/flipy-shipments";
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
  validateFlipyFletePrice,
} from "@/lib/integrations/flipy/flete-rules";
import { FLIPY_ESCENARIO_OPTIONS } from "@/lib/integrations/flipy/labels";
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
  customerName?: string | null;
  customerPhone?: string | null;
  customerEmail?: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

type Step = "payment" | "pickup" | "delivery" | "flete" | "confirm" | "success" | "recarga";

function peMobileDigits(value: string): string {
  return value.replace(/\D/g, "").slice(-9);
}

function isValidPeMobile(value: string): boolean {
  const digits = peMobileDigits(value);
  return digits.length === 9 && digits.startsWith("9");
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
  customerName = null,
  customerPhone = null,
  customerEmail = null,
  open,
  onOpenChange,
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [step, setStep] = useState<Step>("payment");
  const [error, setError] = useState<string | null>(null);
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const [walletEmbedUrl, setWalletEmbedUrl] = useState<string | null>(null);
  const [escenario, setEscenario] = useState<FlipyEscenarioPago>(
    paymentResolution.suggestedEscenario && paymentResolution.suggestedEscenario !== "GRATIS"
      ? paymentResolution.suggestedEscenario
      : "1E",
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
  const [embedUrl, setEmbedUrl] = useState<string | null>(null);
  const [resolvedEmbedOrigin, setResolvedEmbedOrigin] = useState(embedOrigin);

  const [fletePrice, setFletePrice] = useState<string>(
    initialFleteInputValue(
      paymentResolution.suggestedEscenario && paymentResolution.suggestedEscenario !== "GRATIS"
        ? paymentResolution.suggestedEscenario
        : "1E",
      paymentResolution.suggestedFlete,
    ),
  );
  const [notes, setNotes] = useState("");

  const [result, setResult] = useState<{
    envioId: string;
    trackingUrl?: string | null;
    trackingToken?: string | null;
    estado: string;
    appWebUrl?: string | null;
  } | null>(null);

  const fleteRule = useMemo(() => getFlipyFleteUiRule(escenario), [escenario]);
  const fleteValidation = useMemo(
    () => validateFlipyFletePrice(escenario, fletePrice),
    [escenario, fletePrice],
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

  function applyStoreOrigin() {
    if (!storeOrigin) return;
    setOriginAddress(storeOrigin.address);
    setOriginLat(storeOrigin.lat);
    setOriginLng(storeOrigin.lng);
    setOriginContactName(storeOrigin.contactName);
    setOriginPhone(storeOrigin.phone);
  }

  function applyStoreContact() {
    if (!storeOrigin) return;
    setOriginContactName(storeOrigin.contactName);
    setOriginPhone(storeOrigin.phone);
  }

  function resetFlow() {
    setStep("payment");
    setError(null);
    setErrorCode(null);
    setWalletEmbedUrl(null);
    setDestination(null);
    setEmbedUrl(null);
    setResolvedEmbedOrigin(embedOrigin);
    setResult(null);
    setNotes("");
    const nextEscenario =
      paymentResolution.suggestedEscenario && paymentResolution.suggestedEscenario !== "GRATIS"
        ? paymentResolution.suggestedEscenario
        : "1E";
    setEscenario(nextEscenario);
    setFletePrice(initialFleteInputValue(nextEscenario, paymentResolution.suggestedFlete));
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

  function validatePickup(): string | null {
    if (!originAddress.trim()) return "Indica la dirección de recojo.";
    if (!Number.isFinite(originLat) || !Number.isFinite(originLng)) {
      return "Faltan coordenadas de recojo. Usa la dirección de tu tienda Flipy.";
    }
    if (!originContactName.trim()) return "Indica quién entrega (nombre).";
    if (!isValidPeMobile(originPhone)) {
      return "Celular de quién entrega: 9 dígitos PE (empieza en 9).";
    }
    return null;
  }

  function validateDelivery(): string | null {
    if (!destination) return "Confirma la ubicación en el mapa Flipy.";
    if (!destination.address.trim()) return "La dirección de entrega está vacía — edítala.";
    if (destinationConsistency && !destinationConsistency.ok) {
      return "La dirección textual no coincide con el pin. Corrígela antes de continuar.";
    }
    if (!destContactName.trim()) return "Indica quién recibe (nombre).";
    if (!isValidPeMobile(destPhone)) {
      return "Celular de quién recibe: 9 dígitos PE (empieza en 9).";
    }
    return null;
  }

  function loadDeliveryEmbed() {
    const pickupError = validatePickup();
    if (pickupError) {
      setError(pickupError);
      return;
    }
    setError(null);
    startTransition(async () => {
      const tokenResult = await issueFlipyWidgetTokenAction({
        agencySlug,
        storeSlug,
        orderId,
        prefillAddress,
        prefillLat: prefillCoords?.lat,
        prefillLng: prefillCoords?.lng,
      });
      if (tokenResult.error || !tokenResult.embedUrl) {
        setError(tokenResult.error ?? "No se pudo cargar el mapa Flipy.");
        return;
      }
      setEmbedUrl(tokenResult.embedUrl);
      setResolvedEmbedOrigin(tokenResult.embedOrigin ?? embedOrigin);
      setStep("delivery");
    });
  }

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

  function goFlete() {
    const deliveryError = validateDelivery();
    if (deliveryError) {
      setError(deliveryError);
      return;
    }
    setError(null);
    setFletePrice((prev) =>
      prev.trim() ? prev : initialFleteInputValue(escenario, paymentResolution.suggestedFlete),
    );
    setStep("flete");
  }

  function goConfirm() {
    if (!fleteValidation.ok) {
      setError(fleteValidation.error);
      return;
    }
    setError(null);
    setStep("confirm");
  }

  function submitCreate() {
    const pickupError = validatePickup();
    if (pickupError) {
      setError(pickupError);
      setStep("pickup");
      return;
    }
    const deliveryError = validateDelivery();
    if (deliveryError) {
      setError(deliveryError);
      setStep("delivery");
      return;
    }
    if (!destination || !fleteValidation.ok || fleteValidation.value == null) {
      setError(fleteValidation.error ?? "Revisa la oferta de flete.");
      setStep("flete");
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
        appWebUrl: created.appWebUrl,
      });
      setStep("success");
      router.refresh();
    });
  }

  const title =
    step === "payment"
      ? "Crear envío Flipy — Modalidad"
      : step === "pickup"
        ? "Crear envío Flipy — Recojo"
        : step === "delivery"
          ? "Crear envío Flipy — Entrega"
          : step === "flete"
            ? "Crear envío Flipy — Flete"
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

  const escenarioLabel =
    FLIPY_ESCENARIO_OPTIONS.find((o) => o.value === escenario)?.label ?? escenario;

  return (
    <Dialog open={open} onOpenChange={closeModal} title={title} className="max-w-2xl">
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
              Esto define COD vs prepago; el flete se fija después como oferta a los motorizados.
            </Alert>
            {paymentResolution.suggestedEscenario ? (
              <p className="text-xs text-text-secondary">
                Sugerido según Shopify:{" "}
                <span className="font-medium text-text-primary">
                  {paymentResolution.suggestedEscenario}
                </span>
              </p>
            ) : null}
            <fieldset className="space-y-2">
              {FLIPY_ESCENARIO_OPTIONS.map((opt) => (
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
                      setFletePrice(initialFleteInputValue(opt.value, paymentResolution.suggestedFlete));
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
              <Button
                disabled={pending}
                onClick={() => {
                  setError(null);
                  setStep("pickup");
                }}
              >
                Siguiente: recojo
              </Button>
            </div>
          </div>
        ) : null}

        {step === "pickup" ? (
          <div className="space-y-3">
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="outline" type="button" onClick={applyStoreOrigin} disabled={!storeOrigin}>
                Usar dirección de mi tienda
              </Button>
              <Button size="sm" variant="outline" type="button" onClick={applyStoreContact} disabled={!storeOrigin}>
                Usar datos de mi tienda
              </Button>
            </div>
            <FormField label="Dirección de recojo" htmlFor="flipy-origin-address">
              <Input
                id="flipy-origin-address"
                value={originAddress}
                onChange={(e) => setOriginAddress(e.target.value)}
                placeholder="Av. Larco 123, Miraflores"
              />
            </FormField>
            {Number.isFinite(originLat) && Number.isFinite(originLng) ? (
              <p className="text-xs text-text-secondary">
                Coords recojo: {formatCoordsLabel(originLat, originLng)}
              </p>
            ) : (
              <Alert variant="warning" title="Sin coords de tienda">
                Conecta Flipy con origen completo o pega coords válidas vía “Usar dirección de mi tienda”.
              </Alert>
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
            <div className="flex justify-between gap-2">
              <Button variant="outline" disabled={pending} onClick={() => setStep("payment")}>
                Atrás
              </Button>
              <Button disabled={pending} onClick={() => loadDeliveryEmbed()}>
                {pending ? "Cargando mapa…" : "Siguiente: entrega"}
              </Button>
            </div>
          </div>
        ) : null}

        {step === "delivery" && embedUrl ? (
          <div className="space-y-3">
            <FlipyLocationEmbed
              embedUrl={embedUrl}
              embedOrigin={resolvedEmbedOrigin}
              agencySlug={agencySlug}
              storeSlug={storeSlug}
              prefillAddress={prefillAddress}
              prefillCoords={prefillCoords}
              onConfirmed={(next) => {
                setDestination(next);
                setError(null);
              }}
            />
            {destination ? (
              <div className="grid gap-2 rounded-lg border border-border bg-muted/30 p-3 sm:grid-cols-2">
                <div>
                  <p className="text-xs text-text-secondary">Dirección</p>
                  <p className="font-medium">{destination.address || "—"}</p>
                </div>
                <div>
                  <p className="text-xs text-text-secondary">Pin (lat/lng)</p>
                  <p className="font-mono text-xs">
                    {formatCoordsLabel(destination.lat, destination.lng)}
                  </p>
                </div>
              </div>
            ) : null}
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
            <div className="flex justify-between gap-2">
              <Button variant="outline" disabled={pending} onClick={() => setStep("pickup")}>
                Atrás
              </Button>
              <Button disabled={pending || !destination} onClick={() => goFlete()}>
                Siguiente: flete
              </Button>
            </div>
          </div>
        ) : null}

        {step === "flete" ? (
          <div className="space-y-3">
            <FormField label={fleteRule.label} htmlFor="flipy-flete" hint={fleteRule.hint}>
              <Input
                id="flipy-flete"
                inputMode="decimal"
                value={fletePrice}
                onChange={(e) => setFletePrice(e.target.value)}
                placeholder={
                  paymentResolution.suggestedFlete
                    ? String(paymentResolution.suggestedFlete)
                    : "15.00"
                }
              />
            </FormField>
            {fleteValidation.ok && fleteValidation.value != null ? (
              <p className="text-xs text-text-secondary">
                Oferta: {formatCurrency(fleteValidation.value, currencyCode)}
              </p>
            ) : null}
            <FormField label="Notas para el motorizado (opcional)" htmlFor="flipy-notes">
              <Input
                id="flipy-notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Timbre, referencia, horario…"
              />
            </FormField>
            <p className="text-xs text-text-secondary">
              Tamaño de paquete: diferido (Partner API aún no expuesto en CT).
            </p>
            <div className="flex justify-between gap-2">
              <Button variant="outline" disabled={pending} onClick={() => setStep("delivery")}>
                Atrás
              </Button>
              <Button disabled={pending || !fleteValidation.ok} onClick={() => goConfirm()}>
                Siguiente: confirmar
              </Button>
            </div>
          </div>
        ) : null}

        {step === "confirm" && destination ? (
          <div className="space-y-3">
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
                <dt className="text-text-secondary">Oferta de flete</dt>
                <dd className="font-medium">
                  {formatCurrency(fleteValidation.value ?? 0, currencyCode)}
                </dd>
              </div>
              {notes.trim() ? (
                <div>
                  <dt className="text-text-secondary">Notas</dt>
                  <dd>{notes.trim()}</dd>
                </div>
              ) : null}
            </dl>
            {destinationConsistency && !destinationConsistency.ok ? (
              <Alert variant="danger" title="Destino inconsistente">
                No se puede crear: la dirección textual no coincide con el pin. Vuelve a Entrega.
              </Alert>
            ) : null}
            <div className="flex justify-between gap-2">
              <Button variant="outline" disabled={pending} onClick={() => setStep("flete")}>
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
                setStep(destination ? "confirm" : "payment");
              }}
            />
            <div className="flex justify-between gap-2">
              <Button
                variant="outline"
                disabled={pending}
                onClick={() => setStep(destination ? "confirm" : "payment")}
              >
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
            <Alert variant="success" title="Envío creado">
              Estado Flipy: {result.estado}. Se persistió la misma dirección que viste en Confirmar.
            </Alert>
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
            <FlipyBidsEmbed
              agencySlug={agencySlug}
              storeSlug={storeSlug}
              orderId={orderId}
              envioId={result.envioId}
              embedOrigin={embedOrigin}
            />
            <div className="flex flex-wrap gap-2">
              {flipyOperationLink ? (
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
              <Button
                variant="outline"
                onClick={() => {
                  if (result.trackingUrl) void navigator.clipboard.writeText(result.trackingUrl);
                }}
              >
                Copiar link rastreo
              </Button>
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
