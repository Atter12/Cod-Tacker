"use client";

import { useState, useTransition } from "react";
import { issueFlipyActivationUrlAction } from "@/app/actions/flipy-activation";
import { buildFlipyAppLoginUrl } from "@/lib/integrations/flipy/embed-urls";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";

type Props = {
  agencySlug: string;
  storeSlug: string;
  appOrigin: string;
  contactEmail: string;
  /** Shown right after a successful connect in the form. */
  highlightAfterConnect?: boolean;
};

export function FlipyAppAccessPanel({
  agencySlug,
  storeSlug,
  appOrigin,
  contactEmail,
  highlightAfterConnect = false,
}: Props) {
  const loginUrl = buildFlipyAppLoginUrl({ appOrigin, contactEmail });
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function openActivation() {
    setError(null);
    setInfo(null);
    start(async () => {
      const result = await issueFlipyActivationUrlAction({
        agencySlug,
        storeSlug,
        contactEmail,
      });
      if (result.error || !result.activationUrl) {
        setError(
          result.error ??
            "No se pudo iniciar la activación. Verifica que Flipy esté conectado e intenta de nuevo.",
        );
        return;
      }
      if (result.usedPasswordRecoveryFallback) {
        setInfo(
          "La activación directa aún no está en el backend Flipy. Te abrimos recuperación de contraseña con tu correo de contacto para que definas tu clave.",
        );
      }
      window.open(result.activationUrl, "_blank", "noopener,noreferrer");
    });
  }

  return (
    <div className="rounded-lg border border-border bg-surface-elevated p-4">
      <h2 className="text-sm font-semibold">Acceso a la app tienda Flipy</h2>
      <p className="mt-1 text-[12.5px] leading-relaxed text-text-secondary">
        La integración creó tu tienda en Flipy con{" "}
        <span className="font-medium text-text-primary">{contactEmail}</span>, sin contraseña.
        Para operar en la app móvil o web de Flipy (fuera de los embeds de COD-tracked), activa
        tu cuenta y define una contraseña en Flipy.
      </p>

      {highlightAfterConnect ? (
        <div className="mt-3">
          <Alert variant="success" title="Flipy conectado">
            Siguiente paso: activa tu acceso a la app Flipy con el correo de contacto que
            registraste.
          </Alert>
        </div>
      ) : null}

      {info ? (
        <div className="mt-3">
          <Alert variant="info" title="Activación Flipy">
            {info}
          </Alert>
        </div>
      ) : null}

      {error ? (
        <div className="mt-3">
          <Alert variant="warning" title="Activación Flipy">
            {error}
          </Alert>
        </div>
      ) : null}

      <div className="mt-3 flex flex-wrap gap-2">
        <Button size="sm" type="button" disabled={pending} onClick={() => openActivation()}>
          {pending ? "Preparando enlace…" : "Activar cuenta en Flipy"}
        </Button>
        <a
          href={loginUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex h-8 items-center justify-center rounded-md border border-border px-3 text-xs font-medium hover:bg-muted"
        >
          Ya tengo contraseña → Entrar
        </a>
      </div>

      <p className="mt-3 text-[11px] leading-relaxed text-text-secondary">
        COD-tracked no guarda ni pide tu contraseña de Flipy. El enlace de activación es de un solo
        uso y caduca en pocos minutos; si expira, vuelve a pulsar «Activar cuenta en Flipy». Si ya
        activaste, usa «Entrar» o «Olvidé mi contraseña» en la app Flipy.
      </p>
    </div>
  );
}
