"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { updateFlipyPickupKeywordsAction } from "@/app/actions/flipy-settings";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { FormField } from "@/components/ui";

type Props = {
  agencySlug: string;
  storeSlug: string;
  defaultKeywords: string[];
  disabled?: boolean;
};

export function FlipyPickupSettings({
  agencySlug,
  storeSlug,
  defaultKeywords,
  disabled = false,
}: Props) {
  const router = useRouter();
  const [keywords, setKeywords] = useState(defaultKeywords.join(", "));
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function save() {
    setError(null);
    setSuccess(null);
    start(async () => {
      const result = await updateFlipyPickupKeywordsAction({
        agencySlug,
        storeSlug,
        keywordsText: keywords,
      });
      if (result.error) {
        setError(result.error);
        return;
      }
      setSuccess("Reglas de recojo guardadas.");
      router.refresh();
    });
  }

  return (
    <div className="space-y-3 rounded-lg border border-border bg-surface-elevated p-4">
      <h2 className="text-sm font-semibold">Reglas de recojo (Shopify)</h2>
      <p className="text-[12.5px] text-text-secondary">
        Palabras clave adicionales en título o código de línea de envío que indican recojo en
        tienda. Se combinan con las reglas por defecto (pickup, recojo, retiro…).
      </p>
      <FormField label="Palabras clave" htmlFor="flipy-pickup-keywords">
        <textarea
          id="flipy-pickup-keywords"
          value={keywords}
          onChange={(e) => setKeywords(e.target.value)}
          disabled={disabled || pending}
          rows={3}
          className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm"
          placeholder="retiro en tienda, click and collect"
        />
      </FormField>
      {error ? <Alert variant="danger" title="Error">{error}</Alert> : null}
      {success ? <Alert variant="success" title="Guardado">{success}</Alert> : null}
      <Button size="sm" disabled={disabled || pending} onClick={save}>
        {pending ? "Guardando…" : "Guardar reglas"}
      </Button>
    </div>
  );
}
