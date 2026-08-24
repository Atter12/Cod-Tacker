"use client";

import { useEffect, useState } from "react";
import { Alert } from "@/components/ui/Alert";
import { isAllowedFlipyPostMessageOrigin } from "@/lib/integrations/flipy/embed-urls";
import { parseFlipyWalletErrorMessage, parseFlipyWalletToppedUpMessage } from "@/lib/integrations/flipy/post-message";
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
    <div className="space-y-2">
      <p className="text-xs text-text-secondary">
        Recarga la billetera Operaciones sin salir de COD-tracked. Al completar el pago, podrás
        reintentar crear el envío.
      </p>
      <div className="overflow-hidden rounded-lg border border-border bg-zinc-950">
        <iframe
          title="Recarga Flipy"
          src={embedUrl}
          className="h-[min(52vh,420px)] w-full border-0"
          allow="payment"
        />
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
