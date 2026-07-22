"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { requestWhatsappCodConfirmation } from "@/app/actions/whatsapp";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";

export function RequestWhatsappConfirmationButton({
  agencySlug,
  storeSlug,
  orderId,
  paymentStatus,
  confirmationStatus,
  canManage,
}: {
  agencySlug: string;
  storeSlug: string;
  orderId: string;
  paymentStatus: string;
  confirmationStatus: string;
  canManage: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  const eligible =
    paymentStatus === "cash_expected" &&
    confirmationStatus !== "confirmed" &&
    confirmationStatus !== "rejected";

  if (!canManage || !eligible) return null;

  return (
    <div className="space-y-2 pt-2">
      {error ? (
        <Alert variant="danger" title="WhatsApp">
          {error}
        </Alert>
      ) : null}
      {ok ? (
        <Alert variant="success" title="Listo">
          {ok}
        </Alert>
      ) : null}
      <Button
        size="sm"
        variant="secondary"
        disabled={pending}
        onClick={() => {
          setError(null);
          setOk(null);
          start(async () => {
            const result = await requestWhatsappCodConfirmation(agencySlug, storeSlug, orderId);
            if (result.error) {
              setError(result.error);
              return;
            }
            setOk("Confirmación WhatsApp encolada. Refresca en unos segundos.");
            router.refresh();
          });
        }}
      >
        Solicitar confirmación WhatsApp
      </Button>
    </div>
  );
}
