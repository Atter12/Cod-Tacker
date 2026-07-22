"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { connectWhatsAppLiveAction } from "@/app/actions/integrations";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { FormField, Input } from "@/components/ui";

type Props = {
  agencySlug: string;
  storeSlug: string;
  webhookUrl: string;
  connected?: boolean;
  phoneNumberId?: string | null;
  disabled?: boolean;
};

export function WhatsAppConnectForm({
  agencySlug,
  storeSlug,
  webhookUrl,
  connected = false,
  phoneNumberId = null,
  disabled = false,
}: Props) {
  const router = useRouter();
  const [accessToken, setAccessToken] = useState("");
  const [phoneId, setPhoneId] = useState(phoneNumberId ?? "");
  const [templateName, setTemplateName] = useState("");
  /** Meta sample COD template uses en_US; PE production templates often use es. */
  const [templateLanguage, setTemplateLanguage] = useState("en_US");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [pending, start] = useTransition();

  function connect() {
    setError(null);
    setSuccess(null);
    const token = accessToken.trim();
    const phone = phoneId.trim();
    if (!token) {
      setError("Pega el access token de WhatsApp Cloud API.");
      return;
    }
    if (!phone) {
      setError("Phone number ID es obligatorio.");
      return;
    }
    start(async () => {
      const result = await connectWhatsAppLiveAction(agencySlug, storeSlug, {
        accessToken: token,
        phoneNumberId: phone,
        confirmationTemplateName: templateName.trim() || undefined,
        confirmationTemplateLanguage: templateLanguage.trim() || "en_US",
      });
      if (result.error) {
        setError(result.error);
        return;
      }
      setSuccess(
        connected
          ? "Credenciales WhatsApp actualizadas."
          : "WhatsApp conectado. Registra el webhook en Meta con el verify token de Vercel.",
      );
      setAccessToken("");
      router.refresh();
    });
  }

  async function copyUrl() {
    try {
      await navigator.clipboard.writeText(webhookUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setError("No se pudo copiar. Selecciona la URL manualmente.");
    }
  }

  return (
    <div className="space-y-3 rounded-lg border border-border bg-surface-elevated p-4">
      <h2 className="text-sm font-semibold">
        {connected ? "Actualizar WhatsApp Business" : "Conectar WhatsApp Business"}
      </h2>
      <p className="text-[12.5px] text-text-secondary">
        Token cifrado por tienda. El webhook exige X-Hub-Signature-256 con WHATSAPP_APP_SECRET en
        Production.
      </p>
      {error ? (
        <Alert variant="danger" title="WhatsApp">
          {error}
        </Alert>
      ) : null}
      {success ? (
        <Alert variant="success" title="Listo">
          {success}
        </Alert>
      ) : null}

      <FormField label="Access token" htmlFor="wa-access-token">
        <Input
          id="wa-access-token"
          type="password"
          autoComplete="off"
          placeholder={connected ? "•••••••• (pegar nuevo token para rotar)" : "Cloud API token"}
          value={accessToken}
          onChange={(e) => setAccessToken(e.target.value)}
          disabled={disabled || pending}
        />
      </FormField>
      <FormField label="Phone number ID" htmlFor="wa-phone-id">
        <Input
          id="wa-phone-id"
          autoComplete="off"
          placeholder="Graph phone_number_id"
          value={phoneId}
          onChange={(e) => setPhoneId(e.target.value)}
          disabled={disabled || pending}
        />
      </FormField>
      <FormField label="Plantilla confirmación COD (Meta, opcional)" htmlFor="wa-tpl">
        <Input
          id="wa-tpl"
          autoComplete="off"
          placeholder="jaspers_market_order_confirmation_v1"
          value={templateName}
          onChange={(e) => setTemplateName(e.target.value)}
          disabled={disabled || pending}
        />
      </FormField>
      <FormField label="Idioma plantilla (Meta)" htmlFor="wa-tpl-lang">
        <Input
          id="wa-tpl-lang"
          autoComplete="off"
          placeholder="en_US"
          value={templateLanguage}
          onChange={(e) => setTemplateLanguage(e.target.value)}
          disabled={disabled || pending}
        />
      </FormField>
      <p className="text-[11px] text-text-secondary">
        La plantilla de prueba de Meta usa <span className="font-mono">en_US</span>. Si guardas{" "}
        <span className="font-mono">es</span> por error, Graph rechaza el envío.
      </p>

      <Button type="button" disabled={disabled || pending} onClick={connect}>
        {connected ? "Guardar credenciales" : "Conectar WhatsApp"}
      </Button>

      <div className="rounded-md border border-border bg-surface p-3">
        <p className="text-xs font-medium text-text-secondary">Webhook URL (Meta)</p>
        <p className="mt-1 break-all font-mono text-[11px]">{webhookUrl}</p>
        <Button type="button" size="sm" variant="secondary" className="mt-2" onClick={copyUrl}>
          {copied ? "Copiado" : "Copiar URL"}
        </Button>
      </div>
    </div>
  );
}
