"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { connectEnviaLiveAction } from "@/app/actions/integrations";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { FormField, Input } from "@/components/ui";

type Props = {
  agencySlug: string;
  storeSlug: string;
  globalWebhookUrl: string;
  storeWebhookUrl: string;
  connected?: boolean;
  externalAccountId?: string | null;
  disabled?: boolean;
};

export function EnviaConnectForm({
  agencySlug,
  storeSlug,
  globalWebhookUrl,
  storeWebhookUrl,
  connected = false,
  externalAccountId = null,
  disabled = false,
}: Props) {
  const router = useRouter();
  const [apiToken, setApiToken] = useState("");
  const [companyId, setCompanyId] = useState(externalAccountId ?? "");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [copied, setCopied] = useState<"global" | "store" | null>(null);
  const [pending, start] = useTransition();

  function connect() {
    setError(null);
    setSuccess(null);
    const token = apiToken.trim();
    if (!token) {
      setError("Pega el token de Envia (Desarrolladores → Acceso de API).");
      return;
    }
    start(async () => {
      const result = await connectEnviaLiveAction(agencySlug, storeSlug, {
        apiToken: token,
        externalAccountId: companyId.trim() || undefined,
      });
      if (result.error) {
        setError(result.error);
        return;
      }
      setSuccess(
        connected
          ? "Token Envia actualizado. Usa la URL de abajo en el panel de Webhooks."
          : "Envia conectado. Copia la URL del webhook y pégala en Envia.",
      );
      setApiToken("");
      router.refresh();
    });
  }

  async function copyUrl(kind: "global" | "store", url: string) {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(kind);
      window.setTimeout(() => setCopied(null), 2000);
    } catch {
      setError("No se pudo copiar. Selecciona la URL manualmente.");
    }
  }

  return (
    <div className="space-y-3 rounded-lg border border-border bg-surface-elevated p-4">
      <h2 className="text-sm font-semibold">
        {connected ? "Actualizar Envia.com" : "Conectar Envia.com"}
      </h2>
      <p className="text-[12.5px] text-text-secondary">
        Guarda el token de API de esta cuenta Envia. El tenant vive en la fila de integración o en la
        URL por tienda — no en un env global.
      </p>
      {error ? (
        <Alert variant="danger" title="Envia">
          {error}
        </Alert>
      ) : null}
      {success ? (
        <Alert variant="success" title="Listo">
          {success}
        </Alert>
      ) : null}

      <FormField label="Token API Envia" htmlFor="envia-api-token">
        <Input
          id="envia-api-token"
          type="password"
          autoComplete="off"
          placeholder={connected ? "•••••••• (pegar nuevo token para rotar)" : "Bearer token de Acceso de API"}
          value={apiToken}
          disabled={disabled || pending}
          onChange={(e) => setApiToken(e.target.value)}
        />
      </FormField>
      <FormField label="Company / cuenta Envia (opcional)" htmlFor="envia-company-id">
        <Input
          id="envia-company-id"
          placeholder="ej. 753887 o nombre de cuenta"
          value={companyId}
          disabled={disabled || pending}
          onChange={(e) => setCompanyId(e.target.value)}
        />
      </FormField>
      <Button size="sm" disabled={disabled || pending} onClick={connect}>
        {pending ? "Guardando…" : connected ? "Actualizar token" : "Conectar Envia"}
      </Button>

      <div className="space-y-2 border-t border-border pt-3">
        <h3 className="text-sm font-semibold">Webhook en Envia</h3>
        <p className="text-[12.5px] text-text-secondary">
          Tipo: <code className="text-text-primary">onShipmentStatusUpdate</code>. Recomendado: URL
          por tienda (explícita). La URL global resuelve por tracking o por token.
        </p>

        <div className="space-y-1">
          <p className="text-[11px] font-medium uppercase tracking-wide text-text-secondary">
            Por tienda (recomendada)
          </p>
          <div className="flex flex-wrap items-start gap-2">
            <code className="min-w-0 flex-1 break-all rounded border border-border bg-surface px-2 py-1.5 text-[11px]">
              {storeWebhookUrl}
            </code>
            <Button
              size="sm"
              variant="outline"
              type="button"
              disabled={disabled}
              onClick={() => void copyUrl("store", storeWebhookUrl)}
            >
              {copied === "store" ? "Copiado" : "Copiar"}
            </Button>
          </div>
        </div>

        <div className="space-y-1">
          <p className="text-[11px] font-medium uppercase tracking-wide text-text-secondary">
            Global (multi-tienda)
          </p>
          <div className="flex flex-wrap items-start gap-2">
            <code className="min-w-0 flex-1 break-all rounded border border-border bg-surface px-2 py-1.5 text-[11px]">
              {globalWebhookUrl}
            </code>
            <Button
              size="sm"
              variant="outline"
              type="button"
              disabled={disabled}
              onClick={() => void copyUrl("global", globalWebhookUrl)}
            >
              {copied === "global" ? "Copiado" : "Copiar"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
