"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { connectFlipyLiveAction } from "@/app/actions/integrations";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { FormField, Input } from "@/components/ui";
import { routes } from "@/config/routes";

type Props = {
  agencySlug: string;
  storeSlug: string;
  webhookUrl: string;
  connected?: boolean;
  flipyTiendaId?: string | null;
  defaultNombre?: string | null;
  defaultEmail?: string | null;
  defaultTelefono?: string | null;
  defaultOriginAddress?: string | null;
  defaultOriginLat?: number | null;
  defaultOriginLng?: number | null;
  contactEmailVerified?: boolean;
  settingsHref?: string;
  disabled?: boolean;
};

export function FlipyConnectForm({
  agencySlug,
  storeSlug,
  webhookUrl,
  connected = false,
  flipyTiendaId = null,
  defaultNombre = null,
  defaultEmail = null,
  defaultTelefono = null,
  defaultOriginAddress = null,
  defaultOriginLat = null,
  defaultOriginLng = null,
  contactEmailVerified = false,
  settingsHref,
  disabled = false,
}: Props) {
  const router = useRouter();
  const [nombre, setNombre] = useState(defaultNombre ?? "");
  const [ruc, setRuc] = useState("");
  const [email, setEmail] = useState(defaultEmail ?? "");
  const [telefono, setTelefono] = useState(defaultTelefono ?? "");
  const [originAddress, setOriginAddress] = useState(defaultOriginAddress ?? "");
  const [originLat, setOriginLat] = useState(
    defaultOriginLat != null ? String(defaultOriginLat) : "",
  );
  const [originLng, setOriginLng] = useState(
    defaultOriginLng != null ? String(defaultOriginLng) : "",
  );
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [pending, start] = useTransition();

  const blockedNewConnect = !connected && !contactEmailVerified;
  const emailReadonly = contactEmailVerified && Boolean(defaultEmail);
  const formDisabled = disabled || pending || blockedNewConnect;

  function connect() {
    setError(null);
    setSuccess(null);
    const lat = Number.parseFloat(originLat);
    const lng = Number.parseFloat(originLng);
    if (!nombre.trim()) {
      setError("Nombre de tienda requerido.");
      return;
    }
    if (!email.trim()) {
      setError("Email de contacto requerido (contactEmail en Flipy).");
      return;
    }
    if (!originAddress.trim()) {
      setError("Dirección de origen requerida.");
      return;
    }
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      setError("Latitud y longitud de origen requeridas (decimales).");
      return;
    }

    start(async () => {
      const result = await connectFlipyLiveAction(agencySlug, storeSlug, {
        nombre: nombre.trim(),
        ruc: ruc.trim() || undefined,
        email: email.trim() || undefined,
        telefono: telefono.trim() || undefined,
        originAddress: originAddress.trim(),
        originLat: lat,
        originLng: lng,
      });
      if (result.error) {
        setError(result.error);
        return;
      }
      setSuccess(
        connected
          ? "Flipy actualizado. Configuración guardada y webhook re-registrado."
          : "Flipy conectado. Activa tu acceso a la app Flipy con el correo de contacto que registraste.",
      );
      router.refresh();
    });
  }

  async function copyUrl() {
    try {
      await navigator.clipboard.writeText(webhookUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setError("No se pudo copiar la URL del webhook.");
    }
  }

  const settingsLink =
    settingsHref ?? routes.store.settings(agencySlug, storeSlug);

  return (
    <div className="space-y-3 rounded-lg border border-border bg-surface-elevated p-4">
      <h2 className="text-sm font-semibold">
        {connected ? "Actualizar Flipy" : "Conectar Flipy"}
      </h2>
      <p className="text-[12.5px] text-text-secondary">
        Provisiona la tienda en Flipy vía Partner API. Requiere{" "}
        <code className="text-[11px]">FLIPY_PARTNER_API_KEY</code> en el servidor y Partner API
        activa en Flipy.
      </p>
      {flipyTiendaId ? (
        <p className="text-[12px] text-text-secondary">
          Tienda Flipy vinculada: <span className="font-mono">{flipyTiendaId}</span>
        </p>
      ) : null}

      {blockedNewConnect ? (
        <Alert variant="warning" title="Correo de tienda sin verificar">
          Verifica el correo operativo de esta tienda en{" "}
          <Link href={settingsLink} className="font-medium underline">
            Configuración
          </Link>{" "}
          antes de conectar Flipy.
        </Alert>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2">
        <FormField label="Nombre tienda" htmlFor="flipy-nombre">
          <Input
            id="flipy-nombre"
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            disabled={formDisabled}
          />
        </FormField>
        <FormField label="RUC" htmlFor="flipy-ruc">
          <Input
            id="flipy-ruc"
            value={ruc}
            onChange={(e) => setRuc(e.target.value)}
            disabled={formDisabled}
          />
        </FormField>
        <FormField label="Email contacto" htmlFor="flipy-email">
          <Input
            id="flipy-email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={formDisabled || emailReadonly}
            readOnly={emailReadonly}
            placeholder="ops@tienda.pe"
          />
          {contactEmailVerified ? (
            <p className="mt-1 text-[11px] text-text-secondary">
              Correo verificado en CODTracked — identidad Flipy de esta tienda.
            </p>
          ) : connected ? (
            <p className="mt-1 text-[11px] text-text-secondary">
              Correo de la cuenta Flipy (login y activación). Al actualizar, CT guarda el cambio y
              sincroniza con Flipy cuando la Partner API lo expone.
            </p>
          ) : null}
        </FormField>
        <FormField label="Teléfono" htmlFor="flipy-telefono">
          <Input
            id="flipy-telefono"
            value={telefono}
            onChange={(e) => setTelefono(e.target.value)}
            disabled={formDisabled}
          />
        </FormField>
      </div>

      <FormField label="Dirección origen (almacén / tienda)" htmlFor="flipy-origin-address">
        <Input
          id="flipy-origin-address"
          value={originAddress}
          onChange={(e) => setOriginAddress(e.target.value)}
          disabled={formDisabled}
          placeholder="Av. Ejemplo 123, Lima"
        />
      </FormField>
      <div className="grid gap-3 sm:grid-cols-2">
        <FormField label="Latitud origen" htmlFor="flipy-origin-lat">
          <Input
            id="flipy-origin-lat"
            value={originLat}
            onChange={(e) => setOriginLat(e.target.value)}
            disabled={formDisabled}
            placeholder="-12.119"
          />
        </FormField>
        <FormField label="Longitud origen" htmlFor="flipy-origin-lng">
          <Input
            id="flipy-origin-lng"
            value={originLng}
            onChange={(e) => setOriginLng(e.target.value)}
            disabled={formDisabled}
            placeholder="-77.029"
          />
        </FormField>
      </div>

      <div className="rounded-md border border-border/80 bg-surface p-3">
        <p className="text-[12px] font-medium">Webhook (auto-registrado al conectar)</p>
        <p className="mt-1 break-all font-mono text-[11px] text-text-secondary">{webhookUrl}</p>
        <Button
          size="sm"
          variant="outline"
          className="mt-2"
          disabled={formDisabled}
          onClick={() => copyUrl()}
        >
          {copied ? "Copiado" : "Copiar URL"}
        </Button>
      </div>

      {error ? <Alert variant="danger" title="Error">{error}</Alert> : null}
      {success ? <Alert variant="success" title="Listo">{success}</Alert> : null}

      <Button disabled={formDisabled} onClick={connect}>
        {pending ? "Conectando…" : connected ? "Actualizar Flipy" : "Conectar Flipy"}
      </Button>
    </div>
  );
}
