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
    <div className="rounded-[11px] border border-border bg-surface-elevated p-4 shadow-[var(--card-shadow)] sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 space-y-0.5">
          <h2 className="text-sm font-semibold text-text-primary">Acceso a la app tienda Flipy</h2>
          <p className="text-[12.5px] text-text-secondary">
            Opera fuera de los embeds de COD-tracked con el mismo correo de tienda.
          </p>
        </div>
        <a
          href={loginUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex h-8 shrink-0 items-center justify-center rounded-md bg-brand-primary px-3 text-xs font-medium text-white transition-colors hover:bg-brand-primary/90"
        >
          Entrar en Flipy ↗
        </a>
      </div>

      {alreadyActivated ? (
        <div className="mt-4">
          <Alert variant="success" title="Cuenta Flipy activa">
            Ya puedes iniciar sesión en la app móvil o web con este correo.
          </Alert>
        </div>
      ) : activationReady ? (
        <div className="mt-4">
          <Alert variant="info" title="Pendiente de contraseña">
            Falta crear tu contraseña en Flipy para usar la app fuera de COD-tracked.
          </Alert>
        </div>
      ) : !emailVerified ? (
        <div className="mt-4">
          <Alert variant="warning" title="Correo no verificado">
            Verifica el correo operativo de la tienda en Configuración antes de activar la app Flipy.
          </Alert>
        </div>
      ) : null}

      {highlightAfterConnect && !alreadyActivated ? (
        <div className="mt-4">
          <Alert variant="success" title="Flipy conectado">
            Siguiente paso: activa tu acceso a la app Flipy con el correo verificado de la tienda.
          </Alert>
        </div>
      ) : null}

      {error ? (
        <div className="mt-4">
          <Alert variant="warning" title="Activación Flipy">
            {error}
          </Alert>
        </div>
      ) : null}
      {info ? (
        <div className="mt-4">
          <Alert variant="info" title="Flipy">
            {info}
          </Alert>
        </div>
      ) : null}

      {!alreadyActivated && activationReady ? (
        <div className="mt-4">
          <Button size="sm" type="button" disabled={pending} onClick={() => openActivation()}>
            {pending ? "Preparando enlace…" : "Activar cuenta en Flipy"}
          </Button>
        </div>
      ) : null}

      <div className="mt-4 grid gap-4 border-t border-dashed border-border pt-4 sm:grid-cols-2">
        <div className="space-y-2">
          <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-text-secondary">
            Correo operativo
          </p>
          <p className="truncate text-sm font-medium text-text-primary">{contactEmail}</p>
          <ul className="flex flex-wrap gap-1.5">
            <li
              className={
                emailVerified
                  ? "rounded-full bg-success-soft px-2 py-0.5 text-[11px] font-medium text-success"
                  : "rounded-full bg-warning/10 px-2 py-0.5 text-[11px] font-medium text-warning"
              }
            >
              {emailVerified ? "Email verificado" : "Email pendiente"}
            </li>
            <li
              className={
                alreadyActivated
                  ? "rounded-full bg-success-soft px-2 py-0.5 text-[11px] font-medium text-success"
                  : activationReady
                    ? "rounded-full bg-brand-soft px-2 py-0.5 text-[11px] font-medium text-brand-primary"
                    : "rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-text-secondary"
              }
            >
              {alreadyActivated
                ? "Contraseña creada"
                : activationReady
                  ? "Pendiente contraseña"
                  : "Sin activar"}
            </li>
          </ul>
        </div>
        <div className="space-y-2">
          <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-text-secondary">
            Certificación
          </p>
          <p className="text-sm font-medium text-text-primary">Partner Trust v0.2.1</p>
          <p className="text-[12px] text-text-secondary">Sin OTP duplicado en Flipy</p>
        </div>
      </div>
    </div>
  );
}
