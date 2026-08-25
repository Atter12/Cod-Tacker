"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { updateFlipyV02SettingsAction } from "@/app/actions/flipy-settings";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";

type Props = {
  agencySlug: string;
  storeSlug: string;
  defaultEnabled: boolean;
  disabled?: boolean;
};

export function FlipyV02Settings({
  agencySlug,
  storeSlug,
  defaultEnabled,
  disabled = false,
}: Props) {
  const router = useRouter();
  const [enabled, setEnabled] = useState(defaultEnabled);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function save() {
    setError(null);
    setSuccess(null);
    start(async () => {
      const result = await updateFlipyV02SettingsAction({
        agencySlug,
        storeSlug,
        enabled,
      });
      if (result.error) {
        setError(result.error);
        return;
      }
      setSuccess(enabled ? "Partner API v0.2 activada para esta tienda." : "v0.2 desactivada — create legacy.");
      router.refresh();
    });
  }

  return (
    <div className="space-y-3 rounded-lg border border-border bg-surface-elevated p-4">
      <h2 className="text-sm font-semibold">Partner API v0.2</h2>
      <p className="text-[12.5px] text-text-secondary">
        Activa el body v0.2 en create envío: fulfillmentMode smart/bid, packageSize, fleteQuote,
        shopifyPayment completo. Rollout seguro por tienda.
      </p>
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={enabled}
          onChange={(e) => setEnabled(e.target.checked)}
          disabled={disabled || pending}
        />
        Activar Flipy v0.2 (`flipy_v02`)
      </label>
      {error ? (
        <Alert variant="danger" title="Error">
          {error}
        </Alert>
      ) : null}
      {success ? (
        <Alert variant="success" title="Guardado">
          {success}
        </Alert>
      ) : null}
      <Button size="sm" disabled={disabled || pending} onClick={() => save()}>
        {pending ? "Guardando…" : "Guardar"}
      </Button>
    </div>
  );
}
