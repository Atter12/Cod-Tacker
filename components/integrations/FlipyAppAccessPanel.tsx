"use client";

import { useState, useTransition } from "react";
import {
  getFlipyActivationStatusAction,
  issueFlipyActivationUrlAction,
} from "@/app/actions/flipy-activation";
import { buildFlipyAppLoginUrl } from "@/lib/integrations/flipy/embed-urls";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";

type Props = {
  agencySlug: string;
  storeSlug: string;
  appOrigin: string;
  contactEmail: string;
  initialActivationReady?: boolean;
  initialAlreadyActivated?: boolean;
  initialEmailVerified?: boolean;
  /** Shown right after a successful connect in the form. */
  highlightAfterConnect?: boolean;
};

export function FlipyAppAccessPanel({
  agencySlug,
  storeSlug,
  appOrigin,
  contactEmail,
  initialActivationReady = false,
  initialAlreadyActivated = false,
  initialEmailVerified = false,
  highlightAfterConnect = false,
}: Props) {
  const loginUrl = buildFlipyAppLoginUrl({ appOrigin, contactEmail });
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [alreadyActivated, setAlreadyActivated] = useState(initialAlreadyActivated);
  const [activationReady, setActivationReady] = useState(initialActivationReady);
  const [emailVerified, setEmailVerified] = useState(initialEmailVerified);
  const [pending, start] = useTransition();

  function openActivation() {
    setError(null);
    setInfo(null);
    start(async () => {
      const status = await getFlipyActivationStatusAction({ agencySlug, storeSlug });
      if (status.error) {
        setError(status.error);
        return;
      }
      if (status.alreadyActivated) {
        setAlreadyActivated(true);
        setInfo("Esta tienda ya tiene contraseña Flipy. Usa «Entrar».");
        return;
      }
      setActivationReady(status.activationReady ?? false);
      setEmailVerified(status.emailVerified ?? false);

      if (!status.emailVerified) {
        setError(
          "El correo de la tienda aún no está verificado. Verifica el correo en Configuración y vuelve a conectar Flipy si hace falta.",
        );
        return;
      }
      if (!status.activationReady) {
        setError(
          "La activación de la app Flipy aún no está disponible para esta tienda. Si ya creaste contraseña, usa «Entrar en Flipy».",
        );
        return;
      }

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
      if (result.alreadyActivated) {
        setAlreadyActivated(true);
        setInfo("La cuenta Flipy ya está activada. Usa «Entrar».");
        return;
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
        tu cuenta y define una contraseña en Flipy. CT certifica el correo verificado vía partner
        trust (v0.2.1) — sin OTP duplicado en Flipy.
      </p>

      <ul className="mt-3 flex flex-wrap gap-2 text-[11px]">
        <li
          className={
            emailVerified
              ? "rounded-full bg-success/10 px-2 py-0.5 font-medium text-success"
              : "rounded-full bg-warning/10 px-2 py-0.5 font-medium text-warning"
          }
        >
          Email {emailVerified ? "verificado" : "pendiente verificación"}
        </li>
        <li
          className={
            alreadyActivated
              ? "rounded-full bg-success/10 px-2 py-0.5 font-medium text-success"
              : activationReady
                ? "rounded-full bg-info/10 px-2 py-0.5 font-medium text-info"
                : "rounded-full bg-muted px-2 py-0.5 font-medium text-text-secondary"
          }
        >
          {alreadyActivated ? "Contraseña creada" : activationReady ? "Pendiente contraseña" : "Sin activar"}
        </li>
      </ul>

      {alreadyActivated ? (
        <div className="mt-3">
          <Alert variant="success" title="Cuenta Flipy activa">
            Ya puedes iniciar sesión en la app Flipy con este correo.
          </Alert>
        </div>
      ) : activationReady ? (
        <div className="mt-3">
          <Alert variant="info" title="Pendiente de contraseña">
            Falta crear tu contraseña en Flipy para usar la app fuera de COD-tracked.
          </Alert>
        </div>
      ) : !emailVerified ? (
        <div className="mt-3">
          <Alert variant="warning" title="Correo no verificado">
            Verifica el correo operativo de la tienda en Configuración antes de activar la app Flipy.
          </Alert>
        </div>
      ) : null}

      {highlightAfterConnect && !alreadyActivated ? (
        <div className="mt-3">
          <Alert variant="success" title="Flipy conectado">
            Siguiente paso: activa tu acceso a la app Flipy con el correo verificado de la tienda.
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
      {info ? (
        <div className="mt-3">
          <Alert variant="info" title="Flipy">
            {info}
          </Alert>
        </div>
      ) : null}

      <div className="mt-3 flex flex-wrap gap-2">
        {!alreadyActivated && activationReady ? (
          <Button size="sm" type="button" disabled={pending} onClick={() => openActivation()}>
            {pending ? "Preparando enlace…" : "Activar cuenta en Flipy"}
          </Button>
        ) : null}
        <a
          href={loginUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex h-8 items-center justify-center rounded-md border border-border px-3 text-xs font-medium hover:bg-muted"
        >
          {alreadyActivated ? "Entrar en Flipy" : "Ya tengo contraseña → Entrar"}
        </a>
      </div>

      <p className="mt-3 text-[11px] leading-relaxed text-text-secondary">
        COD-tracked no guarda ni pide tu contraseña de Flipy. Un correo operativo = una tienda Flipy
        (limitación Flipy). El enlace de activación caduca en ~1 hora; si expira, vuelve a pulsar
        «Activar cuenta en Flipy».
      </p>
    </div>
  );
}
