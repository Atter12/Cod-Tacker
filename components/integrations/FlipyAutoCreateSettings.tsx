"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { updateFlipyAutoCreateSettingsAction } from "@/app/actions/flipy-settings";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { FormField, Select } from "@/components/ui";
import type { FlipyAutoCreateMinConfidence } from "@/lib/integrations/flipy/settings";

type Props = {
  agencySlug: string;
  storeSlug: string;
  defaultEnabled: boolean;
  defaultMinConfidence: FlipyAutoCreateMinConfidence;
  disabled?: boolean;
};

export function FlipyAutoCreateSettings({
  agencySlug,
  storeSlug,
  defaultEnabled,
  defaultMinConfidence,
  disabled = false,
}: Props) {
  const router = useRouter();
  const [enabled, setEnabled] = useState(defaultEnabled);
  const [minConfidence, setMinConfidence] = useState<FlipyAutoCreateMinConfidence>(defaultMinConfidence);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function save() {
    setError(null);
    setSuccess(null);
    start(async () => {
      const result = await updateFlipyAutoCreateSettingsAction({
        agencySlug,
        storeSlug,
        enabled,
        minConfidence,
      });
      if (result.error) {
        setError(result.error);
        return;
      }
      setSuccess(enabled ? "Auto-create activado." : "Auto-create desactivado.");
      router.refresh();
    });
  }

  return (
    <div className="space-y-3 rounded-lg border border-border bg-surface-elevated p-4">
      <h2 className="text-sm font-semibold">Auto-create envío (F4)</h2>
      <p className="text-[12.5px] text-text-secondary">
        Tras un pedido Shopify elegible, COD-tracked intenta crear el envío Flipy automáticamente
        (escenario de alta confianza, no recojo). Si falla el geocode, se alerta para confirmar pin en
        el mapa.
      </p>
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={enabled}
          onChange={(e) => setEnabled(e.target.checked)}
          disabled={disabled || pending}
        />
        Activar auto-create
      </label>
      <FormField label="Confianza mínima del escenario" htmlFor="flipy-auto-create-confidence">
        <Select
          id="flipy-auto-create-confidence"
          value={minConfidence}
          onChange={(e) => setMinConfidence(e.target.value as FlipyAutoCreateMinConfidence)}
          disabled={disabled || pending || !enabled}
        >
          <option value="high">Alta (recomendado)</option>
          <option value="medium">Media</option>
        </Select>
      </FormField>
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
        {pending ? "Guardando…" : "Guardar auto-create"}
      </Button>
    </div>
  );
}
