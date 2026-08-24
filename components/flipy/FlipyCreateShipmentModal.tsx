"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { createFlipyShipmentFromOrder } from "@/app/actions/flipy-shipments";
import { issueFlipyWidgetTokenAction } from "@/app/actions/flipy-widgets";
import { FlipyLocationEmbed } from "@/components/flipy/FlipyLocationEmbed";
import { FlipyWalletEmbed } from "@/components/flipy/FlipyWalletEmbed";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { FormField, Input } from "@/components/ui";
import { formatCurrency } from "@/lib/formatting/currency";
import { FLIPY_ERROR_CODES } from "@/lib/integrations/flipy/errors";
import { buildFlipyOperationDeepLink } from "@/lib/integrations/flipy/embed-urls";
import { FLIPY_ESCENARIO_OPTIONS } from "@/lib/integrations/flipy/labels";
import type { FlipyEscenarioPago, FlipyPaymentResolution } from "@/lib/integrations/flipy/resolve-payment";

type Destination = { address: string; lat: number; lng: number };

type Props = {
  agencySlug: string;
  storeSlug: string;
  orderId: string;
  orderNumber: string;
  currencyCode: string;
  prefillAddress: string;
  embedOrigin: string;
  appOrigin: string;
  paymentResolution: FlipyPaymentResolution;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

type Step = "payment" | "location" | "confirm" | "success" | "recarga";

export function FlipyCreateShipmentModal({
  agencySlug,
  storeSlug,
  orderId,
  orderNumber,
  currencyCode,
  prefillAddress,
  embedOrigin,
  appOrigin,
  paymentResolution,
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
  const [destination, setDestination] = useState<Destination | null>(null);
  const [embedUrl, setEmbedUrl] = useState<string | null>(null);
  const [fletePrice, setFletePrice] = useState<string>(
    paymentResolution.suggestedFlete != null && paymentResolution.suggestedFlete > 0
      ? String(paymentResolution.suggestedFlete)
      : "",
  );
  const [result, setResult] = useState<{
    envioId: string;
    trackingUrl?: string | null;
    trackingToken?: string | null;
    estado: string;
    appWebUrl?: string | null;
  } | null>(null);

  function resetFlow() {
    setStep("payment");
    setError(null);
    setErrorCode(null);
    setWalletEmbedUrl(null);
    setDestination(null);
    setEmbedUrl(null);
    setResult(null);
    setEscenario(
      paymentResolution.suggestedEscenario && paymentResolution.suggestedEscenario !== "GRATIS"
        ? paymentResolution.suggestedEscenario
        : "1E",
    );
    setFletePrice(
      paymentResolution.suggestedFlete != null && paymentResolution.suggestedFlete > 0
        ? String(paymentResolution.suggestedFlete)
        : "",
    );
  }

  function closeModal(nextOpen: boolean) {
    if (!nextOpen) resetFlow();
    onOpenChange(nextOpen);
  }

  function loadEmbed() {
    setError(null);
    startTransition(async () => {
      const tokenResult = await issueFlipyWidgetTokenAction({
        agencySlug,
        storeSlug,
        orderId,
        prefillAddress,
      });
      if (tokenResult.error || !tokenResult.embedUrl) {
        setError(tokenResult.error ?? "No se pudo cargar el mapa Flipy.");
        return;
      }
      setEmbedUrl(tokenResult.embedUrl);
      setStep("location");
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
      setStep("recarga");
    });
  }

  function submitCreate() {
    if (!destination) {
      setError("Confirma la ubicación en el mapa antes de crear el envío.");
      return;
    }
    setError(null);
    const parsedFlete = fletePrice.trim() ? Number.parseFloat(fletePrice) : null;
    startTransition(async () => {
      const created = await createFlipyShipmentFromOrder({
        agencySlug,
        storeSlug,
        orderId,
        escenarioPago: escenario,
        destination,
        fletePrice: parsedFlete != null && Number.isFinite(parsedFlete) ? parsedFlete : null,
      });
      if (created.error || !created.envioId) {
        setError(created.error ?? "No se pudo crear el envío.");
        setErrorCode(
          typeof created.errorCode === "string" ? created.errorCode : null,
        );
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
      ? "Crear envío Flipy — Pago"
      : step === "location"
        ? "Crear envío Flipy — Ubicación"
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

  return (
    <Dialog open={open} onOpenChange={closeModal} title={title} className="max-w-2xl">
      <div className="space-y-4 text-sm">
        <p className="text-text-secondary">
          Pedido <span className="font-medium text-text-primary">{orderNumber}</span>
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
                    onChange={() => setEscenario(opt.value)}
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
              <Button disabled={pending} onClick={() => loadEmbed()}>
                {pending ? "Cargando mapa…" : "Siguiente: ubicación"}
              </Button>
            </div>
          </div>
        ) : null}

        {step === "location" && embedUrl ? (
          <div className="space-y-3">
            <FlipyLocationEmbed
              embedUrl={embedUrl}
              embedOrigin={embedOrigin}
              onConfirmed={(next) => {
                setDestination(next);
                setError(null);
              }}
            />
            <div className="flex justify-between gap-2">
              <Button variant="outline" disabled={pending} onClick={() => setStep("payment")}>
                Atrás
              </Button>
              <Button
                disabled={pending || !destination}
                onClick={() => {
                  if (!destination) {
                    setError("Confirma el pin en el mapa Flipy.");
                    return;
                  }
                  setStep("confirm");
                }}
              >
                Siguiente: resumen
              </Button>
            </div>
          </div>
        ) : null}

        {step === "confirm" && destination ? (
          <div className="space-y-3">
            <dl className="grid gap-2 rounded-lg border border-border bg-muted/30 p-3 text-sm">
              <div>
                <dt className="text-text-secondary">Escenario</dt>
                <dd className="font-medium">
                  {FLIPY_ESCENARIO_OPTIONS.find((o) => o.value === escenario)?.label ?? escenario}
                </dd>
              </div>
              <div>
                <dt className="text-text-secondary">Destino</dt>
                <dd>{destination.address}</dd>
                <dd className="text-xs text-text-secondary">
                  {destination.lat.toFixed(5)}, {destination.lng.toFixed(5)}
                </dd>
              </div>
            </dl>
            <FormField label="Flete (opcional)" htmlFor="flipy-flete">
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
            {fletePrice ? (
              <p className="text-xs text-text-secondary">
                Flete: {formatCurrency(Number.parseFloat(fletePrice) || 0, currencyCode)}
              </p>
            ) : null}
            <div className="flex justify-between gap-2">
              <Button variant="outline" disabled={pending} onClick={() => setStep("location")}>
                Atrás
              </Button>
              <Button disabled={pending} onClick={submitCreate}>
                {pending ? "Creando…" : "Crear envío en Flipy"}
              </Button>
            </div>
          </div>
        ) : null}

        {step === "recarga" && walletEmbedUrl ? (
          <div className="space-y-3">
            <FlipyWalletEmbed
              embedUrl={walletEmbedUrl}
              embedOrigin={embedOrigin}
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
              Estado Flipy: {result.estado}
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
