"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import {
  sendStoreContactEmailOtp,
  setStoreContactEmail,
  verifyStoreContactEmailOtp,
} from "@/app/actions/store-contact-email";
import { OtpCodeInput } from "@/components/auth/OtpCodeInput";
import { buildFlipyAppLoginUrl } from "@/lib/integrations/flipy/embed-urls";
import { Alert, Button, FormField, Input } from "@/components/ui";
import { routes } from "@/config/routes";
import type { StoreContactEmailState } from "@/lib/settings/store-contact-email";

type Props = {
  agencySlug: string;
  storeSlug: string;
  canEdit: boolean;
  contact: StoreContactEmailState;
  appOrigin?: string;
  autoSendOtp?: boolean;
};

export function StoreContactEmailPanel({
  agencySlug,
  storeSlug,
  canEdit,
  contact,
  appOrigin,
  autoSendOtp = false,
}: Props) {
  const router = useRouter();
  const autoSent = useRef(false);
  const [emailDraft, setEmailDraft] = useState(contact.contactEmail ?? "");
  const [token, setToken] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [changeMode, setChangeMode] = useState(false);
  const [flipyLoginEmail, setFlipyLoginEmail] = useState<string | null>(null);
  const [postChangeNeedsActivation, setPostChangeNeedsActivation] = useState(false);
  const [pending, start] = useTransition();

  const verified = Boolean(contact.contactEmail && contact.contactEmailVerifiedAt);
  const pendingVerification = Boolean(contact.contactEmail && !contact.contactEmailVerifiedAt);
  const emailChangePending = Boolean(contact.changeRollbackEmail && pendingVerification);
  const showOtpStep = pendingVerification && !verified;
  const editingEmail = !verified || changeMode || emailChangePending;

  useEffect(() => {
    if (!changeMode) setEmailDraft(contact.contactEmail ?? "");
  }, [contact.contactEmail, changeMode]);

  useEffect(() => {
    if (!autoSendOtp || autoSent.current || !canEdit || verified || !contact.contactEmail) return;
    autoSent.current = true;
    start(async () => {
      const result = await sendStoreContactEmailOtp(agencySlug, storeSlug);
      if (result.error) setError(result.error);
      else if (result.success) setSuccess(result.success);
    });
  }, [autoSendOtp, agencySlug, storeSlug, canEdit, verified, contact.contactEmail]);

  function saveEmail() {
    setError(null);
    setSuccess(null);
    setFlipyLoginEmail(null);
    setPostChangeNeedsActivation(false);
    start(async () => {
      const result = await setStoreContactEmail(agencySlug, storeSlug, emailDraft);
      if (result.error) {
        setError(result.error);
        return;
      }
      setSuccess(result.success ?? "Correo guardado.");
      setToken("");
      setChangeMode(false);
      router.refresh();
    });
  }

  function resendOtp() {
    setError(null);
    setSuccess(null);
    start(async () => {
      const result = await sendStoreContactEmailOtp(agencySlug, storeSlug);
      if (result.error) setError(result.error);
      else setSuccess(result.success ?? "Código reenviado.");
    });
  }

  function verify() {
    setError(null);
    setSuccess(null);
    setFlipyLoginEmail(null);
    setPostChangeNeedsActivation(false);
    start(async () => {
      const result = await verifyStoreContactEmailOtp(agencySlug, storeSlug, token);
      if (result.error) {
        setError(result.error);
        return;
      }
      setSuccess(result.success ?? "Correo verificado.");
      setToken("");
      setChangeMode(false);
      if (result.emailChanged) {
        const newEmail = contact.contactEmail;
        if (result.flipyPasswordSetAt && newEmail) {
          setFlipyLoginEmail(newEmail);
        } else {
          setPostChangeNeedsActivation(true);
        }
      }
      router.refresh();
    });
  }

  const flipyLoginUrl =
    flipyLoginEmail && appOrigin
      ? buildFlipyAppLoginUrl({ appOrigin, contactEmail: flipyLoginEmail })
      : null;

  return (
    <section className="space-y-4 border-b border-border pb-6">
      <div>
        <h3 className="text-[14px] font-semibold text-text-primary">Correo operativo de la tienda</h3>
        <p className="mt-1 text-xs text-text-secondary">
          Identidad Flipy de esta tienda (login y activación). Distinto al correo de tu cuenta de
          agencia. Un correo operativo = una tienda Flipy. Flipy no se puede conectar hasta verificar
          este correo.
        </p>
      </div>

      {verified && !changeMode && !emailChangePending ? (
        <Alert variant="success" title="Correo verificado">
          <span className="font-medium">{contact.contactEmail}</span> está verificado para esta
          tienda.{" "}
          <Link
            href={routes.store.integrationDetail(agencySlug, storeSlug, "flipy")}
            className="underline"
          >
            Integraciones Flipy
          </Link>
        </Alert>
      ) : null}

      {emailChangePending ? (
        <Alert variant="info" title="Cambio de correo en curso">
          Verifica el nuevo correo con el código OTP. El anterior ({contact.changeRollbackEmail})
          quedará reemplazado al confirmar.
        </Alert>
      ) : null}

      {error ? (
        <Alert variant="danger" title="Error">
          {error}
        </Alert>
      ) : null}
      {success ? (
        <Alert variant="success" title="Listo">
          {success}
          {flipyLoginUrl ? (
            <p className="mt-2">
              <a
                href={flipyLoginUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium underline"
              >
                Abrir app Flipy con el nuevo correo
              </a>
              {" "}
              (misma contraseña).
            </p>
          ) : null}
          {postChangeNeedsActivation ? (
            <p className="mt-2">
              <Link
                href={routes.store.integrationDetail(agencySlug, storeSlug, "flipy")}
                className="font-medium underline"
              >
                Ir a Integraciones Flipy para activar con el nuevo correo
              </Link>
            </p>
          ) : null}
        </Alert>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <FormField
          label="Correo de contacto"
          htmlFor="store-contact-email"
          hint="Será el login Flipy de esta tienda."
        >
          <Input
            id="store-contact-email"
            type="email"
            value={emailDraft}
            onChange={(e) => setEmailDraft(e.target.value)}
            disabled={!canEdit || pending || !editingEmail}
            placeholder="ops@tienda.pe"
            required
          />
        </FormField>
        {canEdit && editingEmail ? (
          <div className="flex items-end">
            <Button
              type="button"
              variant="secondary"
              className="h-10"
              disabled={pending || !emailDraft.trim()}
              onClick={saveEmail}
            >
              {pendingVerification && contact.contactEmail === emailDraft.trim().toLowerCase()
                ? "Reenviar código"
                : emailChangePending || changeMode
                  ? "Enviar código al nuevo correo"
                  : "Guardar y enviar código"}
            </Button>
          </div>
        ) : canEdit && verified ? (
          <div className="flex items-end">
            <Button
              type="button"
              variant="outline"
              className="h-10"
              disabled={pending}
              onClick={() => {
                setChangeMode(true);
                setEmailDraft("");
                setError(null);
                setSuccess(null);
              }}
            >
              Cambiar correo
            </Button>
          </div>
        ) : null}
      </div>

      {showOtpStep ? (
        <div className="max-w-sm space-y-3 rounded-[10px] border border-border p-4">
          <p className="text-sm text-text-secondary">
            Ingresa el código enviado a{" "}
            <span className="font-medium text-text-primary">{contact.contactEmail}</span>.
          </p>
          <OtpCodeInput
            value={token}
            onChange={(e) => setToken(e.target.value)}
            disabled={!canEdit || pending}
          />
          <div className="flex flex-wrap gap-2">
            <Button type="button" disabled={pending || token.length !== 6} onClick={verify}>
              {pending ? "Verificando…" : "Verificar correo"}
            </Button>
            <Button type="button" variant="ghost" disabled={pending} onClick={resendOtp}>
              Reenviar código
            </Button>
          </div>
        </div>
      ) : null}

      {!canEdit ? (
        <p className="text-xs text-text-secondary">Solo lectura: no tienes permiso para editar.</p>
      ) : null}
    </section>
  );
}
