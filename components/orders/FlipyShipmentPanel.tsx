"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import {
  cancelFlipyShipment,
  confirmFlipyDevolucion,
  refreshFlipyEnvioStatus,
} from "@/app/actions/flipy-shipments";
import {
  FlipyCreateShipmentModal,
  type FlipyStoreOriginDefaults,
} from "@/components/flipy/FlipyCreateShipmentModal";
import { FlipyEscenarioLabel } from "@/components/flipy/FlipyEscenarioLabel";
import { FlipyMotorizadoRatingPanel } from "@/components/flipy/FlipyMotorizadoRatingPanel";
import { buildFlipyOperationWebUrl } from "@/lib/integrations/flipy/embed-urls";
import {
  flipyCancelBlockedCtaLabel,
  flipyCancelBlockedUserMessage,
  isFlipyImmediateCancelEstado,
  isFlipyTerminalEstado,
} from "@/lib/integrations/flipy/errors";
import type { FlipyPackageCareId } from "@/lib/integrations/flipy/map-package-care";
import type { FlipyPackageSize } from "@/lib/integrations/flipy/map-package-size";
import type { FlipyDevolucionInfo, FlipyTiendaResena } from "@/lib/integrations/flipy/partner-contract";
import type { FlipyPaymentResolution } from "@/lib/integrations/flipy/resolve-payment";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";

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
  storeOrigin?: FlipyStoreOriginDefaults | null;
  defaultPackageSize?: FlipyPackageSize;
  defaultPackageCare?: FlipyPackageCareId[];
  customerName?: string | null;
  customerPhone?: string | null;
  customerEmail?: string | null;
  flipyEnvioId?: string | null;
  flipyEstado?: string | null;
  flipyDevolucion?: FlipyDevolucionInfo | null;
  flipyDevolucionPendiente?: boolean;
  flipyTiendaResena?: FlipyTiendaResena | null;
  flipyCalificacionDisponible?: boolean;
  flipyCalificacionPeso?: number | null;
  flipyTrackingUrl?: string | null;
  canCreate: boolean;
  canManage: boolean;
  pickupOrder: boolean;
};

export function FlipyShipmentPanel({
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
  storeOrigin = null,
  defaultPackageSize = "mediano",
  defaultPackageCare = [],
  customerName = null,
  customerPhone = null,
  customerEmail = null,
  flipyEnvioId = null,
  flipyEstado = null,
  flipyDevolucion = null,
  flipyDevolucionPendiente = false,
  flipyTiendaResena = null,
  flipyCalificacionDisponible = false,
  flipyCalificacionPeso = null,
  flipyTrackingUrl = null,
  canCreate,
  canManage,
  pickupOrder,
}: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [blockedLink, setBlockedLink] = useState<string | null>(null);
  const [blockedHint, setBlockedHint] = useState<string | null>(null);
  const [blockedCta, setBlockedCta] = useState("Gestionar en Flipy");
  const syncAttemptedRef = useRef(false);

  const estadoUpper = flipyEstado?.toUpperCase() ?? null;
  const showConfirmDevolucion = Boolean(canManage && flipyDevolucionPendiente);
  const showCancel =
    Boolean(canManage) &&
    !isFlipyTerminalEstado(flipyEstado) &&
    estadoUpper !== "CANCELADO" &&
    isFlipyImmediateCancelEstado(flipyEstado);

  useEffect(() => {
    if (!flipyEnvioId || !canManage || syncAttemptedRef.current) return;
    const terminalRatingStates = estadoUpper === "ENTREGADO" || estadoUpper === "CANCELADO";
    const shouldSync =
      (estadoUpper === "EN_CURSO" && !flipyDevolucionPendiente && !flipyDevolucion) ||
      (terminalRatingStates && !flipyTiendaResena && !flipyCalificacionDisponible);
    if (!shouldSync) return;

    syncAttemptedRef.current = true;
    setSyncing(true);
    void refreshFlipyEnvioStatus({
      agencySlug,
      storeSlug,
      orderId,
      envioId: flipyEnvioId,
    })
      .then((result) => {
        if (
          !result.error &&
          (result.devolucionPendiente ||
            result.calificacionDisponible ||
            result.tiendaResena)
        ) {
          router.refresh();
        }
      })
      .finally(() => setSyncing(false));
  }, [
    agencySlug,
    storeSlug,
    orderId,
    flipyEnvioId,
    canManage,
    estadoUpper,
    flipyDevolucionPendiente,
    flipyDevolucion,
    flipyTiendaResena,
    flipyCalificacionDisponible,
    router,
  ]);

  if (pickupOrder) {
    return (
      <Alert variant="info" title="Recojo en tienda">
        Este pedido parece ser recojo — no se crea envío Flipy.
      </Alert>
    );
  }

  function clearFeedback() {
    setError(null);
    setSuccess(null);
    setBlockedLink(null);
    setBlockedHint(null);
    setBlockedCta("Gestionar en Flipy");
  }

  function runCancel() {
    if (!flipyEnvioId || !canManage) return;
    clearFeedback();

    startTransition(() => {
      void (async () => {
        const result = await cancelFlipyShipment({
          agencySlug,
          storeSlug,
          orderId,
          envioId: flipyEnvioId,
          motivoLabel: `Cliente canceló el pedido ${orderNumber}`,
        });

        if (result.error) {
          const blockedDetails = {
            resolution: result.resolution ?? null,
            supportHint: result.supportHint ?? null,
          };
          setError(
            flipyCancelBlockedUserMessage({
              code: result.errorCode,
              message: result.error,
              details: blockedDetails,
            }),
          );
          if (result.blocked && result.appWebUrl) {
            setBlockedLink(result.appWebUrl);
            setBlockedHint(result.supportHint ?? null);
            setBlockedCta(flipyCancelBlockedCtaLabel(blockedDetails));
          }
          return;
        }

        setSuccess(
          result.message ??
            (result.idempotent
              ? "Este envío ya estaba cancelado en Flipy."
              : "Envío Flipy cancelado. El saldo reservado se liberó a Operaciones."),
        );
        router.refresh();
      })();
    });
  }

  function runConfirmDevolucion() {
    if (!flipyEnvioId || !canManage) return;
    clearFeedback();

    startTransition(() => {
      void (async () => {
        const result = await confirmFlipyDevolucion({
          agencySlug,
          storeSlug,
          orderId,
          envioId: flipyEnvioId,
          notas: `Devolución confirmada desde COD-tracked — pedido ${orderNumber}`,
        });

        if (result.error) {
          setError(result.error);
          return;
        }

        setSuccess(
          result.message ??
            (result.idempotent
              ? "La devolución ya estaba confirmada en Flipy."
              : "Devolución confirmada. El envío quedó cancelado y el saldo reservado se liberó."),
        );
        router.refresh();
      })();
    });
  }

  if (flipyEnvioId) {
    const flipyLink = buildFlipyOperationWebUrl({
      appOrigin,
      envioId: flipyEnvioId,
    });

    return (
      <div className="space-y-3 rounded-lg border border-border bg-surface-elevated p-4">
        <h2 className="text-sm font-semibold">Flipy</h2>
        <p className="text-xs text-text-secondary">
          Modalidad:{" "}
          {paymentResolution.suggestedEscenario ? (
            <FlipyEscenarioLabel
              escenario={paymentResolution.suggestedEscenario}
              className="text-xs"
            />
          ) : (
            "—"
          )}
        </p>
        {flipyEstado ? (
          <p className="text-xs text-text-secondary">
            Estado Flipy: <span className="font-medium text-text-primary">{flipyEstado}</span>
            {syncing ? <span className="ml-2 text-text-secondary">· sincronizando…</span> : null}
          </p>
        ) : null}
        <p className="font-mono text-xs break-all">{flipyEnvioId}</p>

        {showConfirmDevolucion ? (
          <Alert variant="warning" title="Devolución pendiente de confirmación">
            <div className="space-y-1 text-xs">
              {flipyDevolucion?.motivoLabel ? (
                <p>
                  Motivo: <span className="font-medium">{flipyDevolucion.motivoLabel}</span>
                </p>
              ) : null}
              <p>
                El motorizado inició la devolución. Confirma la recepción del paquete para liberar
                el saldo reservado y cerrar el envío.
              </p>
            </div>
          </Alert>
        ) : null}

        {flipyEnvioId ? (
          <FlipyMotorizadoRatingPanel
            agencySlug={agencySlug}
            storeSlug={storeSlug}
            orderId={orderId}
            envioId={flipyEnvioId}
            calificacionPeso={flipyCalificacionPeso}
            tiendaResena={flipyTiendaResena}
            calificacionDisponible={flipyCalificacionDisponible}
            canManage={canManage}
            onRated={() => router.refresh()}
          />
        ) : null}

        {success ? (
          <Alert variant="success" title="Operación completada">
            {success}
          </Alert>
        ) : null}
        {error ? (
          <Alert variant={blockedLink ? "warning" : "danger"} title="No se pudo completar">
            <div className="space-y-2">
              <p>{error}</p>
              {blockedHint ? <p className="text-xs">{blockedHint}</p> : null}
              {blockedLink ? (
                <a
                  href={blockedLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex h-8 items-center justify-center rounded-md bg-brand-primary px-3 text-xs font-medium text-white hover:bg-brand-primary/90"
                >
                  {blockedCta}
                </a>
              ) : null}
            </div>
          </Alert>
        ) : null}

        <div className="flex flex-wrap gap-2">
          {flipyTrackingUrl ? (
            <a
              href={flipyTrackingUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-8 items-center justify-center rounded-md bg-brand-primary px-3 text-xs font-medium text-white hover:bg-brand-primary/90"
            >
              Rastreo cliente
            </a>
          ) : null}
          {flipyLink ? (
            <a
              href={flipyLink}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-8 items-center justify-center rounded-md border border-border bg-surface-elevated px-3 text-xs font-medium hover:bg-muted"
            >
              Abrir en Flipy
            </a>
          ) : null}
          {showConfirmDevolucion ? (
            <Button size="sm" disabled={pending} onClick={runConfirmDevolucion}>
              {pending ? "Confirmando…" : "Confirmar devolución"}
            </Button>
          ) : null}
          {showCancel ? (
            <Button size="sm" variant="danger" disabled={pending} onClick={runCancel}>
              {pending ? "Cancelando…" : "Cancelar envío Flipy"}
            </Button>
          ) : null}
        </div>
      </div>
    );
  }

  if (!canCreate) return null;

  return (
    <>
      <div className="space-y-3 rounded-lg border border-border bg-surface-elevated p-4">
        <h2 className="text-sm font-semibold">Flipy</h2>
        <p className="text-[12.5px] text-text-secondary">
          Crea un envío: paso 1 ruta (recojo + entrega + paquete + flete), confirmar y listo.
          {paymentResolution.suggestedEscenario ? (
            <>
              {" "}
              Sugerido:{" "}
              {paymentResolution.suggestedEscenario ? (
                <FlipyEscenarioLabel
                  escenario={paymentResolution.suggestedEscenario}
                  className="font-medium"
                />
              ) : null}
              .
            </>
          ) : null}
        </p>
        <Button size="sm" onClick={() => setOpen(true)}>
          Crear envío Flipy
        </Button>
      </div>
      <FlipyCreateShipmentModal
        agencySlug={agencySlug}
        storeSlug={storeSlug}
        orderId={orderId}
        orderNumber={orderNumber}
        currencyCode={currencyCode}
        prefillAddress={prefillAddress}
        prefillCoords={prefillCoords}
        shippingAddress1={shippingAddress1}
        shippingCountryCode={shippingCountryCode}
        shippingCity={shippingCity}
        shippingRegion={shippingRegion}
        embedOrigin={embedOrigin}
        appOrigin={appOrigin}
        paymentResolution={paymentResolution}
        storeOrigin={storeOrigin}
        defaultPackageSize={defaultPackageSize}
        defaultPackageCare={defaultPackageCare}
        customerName={customerName}
        customerPhone={customerPhone}
        customerEmail={customerEmail}
        open={open}
        onOpenChange={setOpen}
      />
    </>
  );
}
