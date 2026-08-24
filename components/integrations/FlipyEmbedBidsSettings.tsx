"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { updateFlipyEmbedBidsEvalAction } from "@/app/actions/flipy-settings";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";

type Props = {
  agencySlug: string;
  storeSlug: string;
  defaultEnabled: boolean;
  disabled?: boolean;
};

export function FlipyEmbedBidsSettings({
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
      const result = await updateFlipyEmbedBidsEvalAction({
        agencySlug,
        storeSlug,
        enabled,
      });
      if (result.error) {
        setError(result.error);
        return;
      }
      setSuccess(enabled ? "Embed pujas activado (evaluación)." : "Embed pujas desactivado.");
      router.refresh();
    });
  }

  return (
    <div className="space-y-3 rounded-lg border border-border bg-surface-elevated p-4">
      <h2 className="text-sm font-semibold">Embed panel pujas (evaluación F4)</h2>
      <p className="text-[12.5px] text-text-secondary">
        Muestra un resumen embebido de pujas del envío en el detalle del pedido. Funcionalidad en
        evaluación — la operación completa sigue en la app Flipy.
      </p>
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={enabled}
          onChange={(e) => setEnabled(e.target.checked)}
          disabled={disabled || pending}
        />
        Activar embed pujas en pedidos
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
      <Button size="sm" disabled={disabled || pending} onClick={save}>
        {pending ? "Guardando…" : "Guardar embed pujas"}
      </Button>
    </div>
  );
}
