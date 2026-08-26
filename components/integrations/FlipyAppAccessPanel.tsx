"use client";

import {
  buildFlipyAppActivationUrl,
  buildFlipyAppLoginUrl,
} from "@/lib/integrations/flipy/embed-urls";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";

type Props = {
  appOrigin: string;
  contactEmail: string;
  activationPath?: string;
  externalStoreId?: string | null;
  flipyTiendaId?: string | null;
  /** Shown right after a successful connect in the form. */
  highlightAfterConnect?: boolean;
};

export function FlipyAppAccessPanel({
  appOrigin,
  contactEmail,
  activationPath,
  externalStoreId = null,
  flipyTiendaId = null,
  highlightAfterConnect = false,
}: Props) {
  const activationUrl = buildFlipyAppActivationUrl({
    appOrigin,
    contactEmail,
    activationPath,
    externalStoreId,
    flipyTiendaId,
  });
  const loginUrl = buildFlipyAppLoginUrl({ appOrigin, contactEmail });

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

      <div className="mt-3 flex flex-wrap gap-2">
        <a href={activationUrl} target="_blank" rel="noopener noreferrer">
          <Button size="sm" type="button">
            Activar cuenta en Flipy
          </Button>
        </a>
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
        COD-tracked no guarda ni pide tu contraseña de Flipy. Si la página de activación no carga,
        usa «Olvidé mi contraseña» en la app Flipy con el mismo correo.
      </p>
    </div>
  );
}
