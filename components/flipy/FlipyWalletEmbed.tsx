"use client";

import { useEffect, useState } from "react";
import { Alert } from "@/components/ui/Alert";
import { isAllowedFlipyPostMessageOrigin } from "@/lib/integrations/flipy/embed-urls";
import {
  parseFlipyWalletErrorMessage,
  parseFlipyWalletToppedUpMessage,
} from "@/lib/integrations/flipy/post-message";
import { formatCurrency } from "@/lib/formatting/currency";

type Props = {
  embedUrl: string;
  embedOrigin: string;
  onToppedUp?: (newBalance: number) => void;
};

export function FlipyWalletEmbed({ embedUrl, embedOrigin, onToppedUp }: Props) {
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    function onMessage(event: MessageEvent) {
      if (!isAllowedFlipyPostMessageOrigin(event.origin, embedOrigin)) return;
      const toppedUp = parseFlipyWalletToppedUpMessage(event.data);
      if (toppedUp) {
        setError(null);
        setSuccess(`Recarga exitosa. Nuevo saldo: ${formatCurrency(toppedUp.newBalance, "PEN")}`);
        onToppedUp?.(toppedUp.newBalance);
        return;
      }
      const walletErr = parseFlipyWalletErrorMessage(event.data);
      if (walletErr) {
        setSuccess(null);
        setError(walletErr.message);
      }
    }
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [embedOrigin, onToppedUp]);

  return (
    <div className="space-y-3">
      <p className="text-[12.5px] leading-relaxed text-text-secondary">
        Elige el monto y paga con tarjeta. El saldo se acredita a{" "}
        <span className="font-medium text-text-primary">Operaciones</span> al completar el pago.
      </p>

      <div className="mx-auto w-full max-w-md">
        <div className="overflow-hidden rounded-[11px] border border-border bg-surface-elevated shadow-[var(--card-shadow)] ring-1 ring-brand-primary/10">
          <div className="border-b border-border bg-brand-softer px-4 py-2.5">
            <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-brand-primary">
              Recarga segura · Stripe
            </p>
            <p className="mt-0.5 text-[12px] text-text-secondary">
              Mínimo S/ 10 · Acredita a Operaciones
            </p>
          </div>
          <div className="bg-surface px-3 py-3 sm:px-4">
            <iframe
              title="Recarga Flipy"
              src={embedUrl}
              className="h-[min(48vh,380px)] w-full rounded-md border border-border/80 bg-surface"
              allow="payment"
            />
          </div>
        </div>
      </div>

      {success ? (
        <Alert variant="success" title="Billetera actualizada">
          {success}
        </Alert>
      ) : null}
      {error ? (
        <Alert variant="danger" title="Recarga">
          {error}
        </Alert>
      ) : null}
    </div>
  );
}
