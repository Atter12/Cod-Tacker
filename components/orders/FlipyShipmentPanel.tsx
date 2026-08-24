"use client";

import { useState } from "react";
import { FlipyCreateShipmentModal } from "@/components/flipy/FlipyCreateShipmentModal";
import { buildFlipyOperationWebUrl } from "@/lib/integrations/flipy/embed-urls";
import { labelFlipyEscenario } from "@/lib/integrations/flipy/labels";
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
  embedOrigin: string;
  appOrigin: string;
  paymentResolution: FlipyPaymentResolution;
  flipyEnvioId?: string | null;
  flipyTrackingUrl?: string | null;
  canCreate: boolean;
  pickupOrder: boolean;
};

export function FlipyShipmentPanel({
  agencySlug,
  storeSlug,
  orderId,
  orderNumber,
  currencyCode,
  prefillAddress,
  embedOrigin,
  appOrigin,
  paymentResolution,
  flipyEnvioId = null,
  flipyTrackingUrl = null,
  canCreate,
  pickupOrder,
}: Props) {
  const [open, setOpen] = useState(false);

  if (pickupOrder) {
    return (
      <Alert variant="info" title="Recojo en tienda">
        Este pedido parece ser recojo — no se crea envío Flipy.
      </Alert>
    );
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
          Escenario: {labelFlipyEscenario(paymentResolution.suggestedEscenario)}
        </p>
        <p className="font-mono text-xs break-all">{flipyEnvioId}</p>
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
          Crea un envío con escenario de pago y ubicación confirmada en el mapa embed.
          {paymentResolution.suggestedEscenario ? (
            <>
              {" "}
              Sugerido:{" "}
              <span className="font-medium">{paymentResolution.suggestedEscenario}</span>.
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
        embedOrigin={embedOrigin}
        appOrigin={appOrigin}
        paymentResolution={paymentResolution}
        open={open}
        onOpenChange={setOpen}
      />
    </>
  );
}
