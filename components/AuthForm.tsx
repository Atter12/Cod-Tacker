"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { OtpCodeInput } from "@/components/auth/OtpCodeInput";
import { Alert, Button, FormField, Input } from "@/components/ui";
import {
  forgotPassword,
  login,
  register,
  resendOtp,
  resetPassword,
  verifyOtp,
  type OtpPurpose,
} from "@/app/actions/auth";
import { completeAccountSetup } from "@/app/actions/profile";

type Kind = "login" | "register" | "verify" | "forgot" | "reset" | "setup";

const copy: Record<Kind, { title: string; submit: string; description?: string }> = {
  login: { title: "Inicia sesión", submit: "Entrar" },
  register: { title: "Crea tu cuenta", submit: "Crear cuenta" },
  verify: {
    title: "Verifica tu correo",
    submit: "Verificar código",
    description: "Ingresa el código de 6 dígitos que enviamos a tu correo para activar la cuenta.",
  },
  forgot: { title: "Recupera tu contraseña", submit: "Enviar instrucciones" },
  reset: { title: "Nueva contraseña", submit: "Actualizar contraseña" },
  setup: { title: "Completa tu perfil", submit: "Continuar" },
};

export function AuthForm({
  kind,
  email: initialEmail = "",
}: {
  kind: Kind;
  email?: string;
  purpose?: OtpPurpose;
}) {
  const [error, setError] = useState<string>();
  const [success, setSuccess] = useState<string>();
  const [pending, setPending] = useState(false);
  const [resendPending, setResendPending] = useState(false);
  const [email, setEmail] = useState(initialEmail);
  const title = copy[kind];

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(undefined);
    setSuccess(undefined);
    setPending(true);
    const data = new FormData(event.currentTarget);
    const formEmail = String(data.get("email") ?? email);
    let result: { error?: string; success?: string } = {};

    try {
      if (kind === "login") {
        result = await login(formEmail, String(data.get("password") ?? ""));
      } else if (kind === "register") {
        result = await register(formEmail, String(data.get("password") ?? ""), String(data.get("fullName") ?? ""));
      } else if (kind === "verify") {
        result = await verifyOtp(formEmail, String(data.get("token") ?? ""));
      } else if (kind === "forgot") {
        result = await forgotPassword(formEmail);
      } else if (kind === "reset") {
        result = await resetPassword(String(data.get("password") ?? ""));
      } else {
        result = await completeAccountSetup({ fullName: String(data.get("fullName") ?? "") });
      }
    } finally {
      setPending(false);
    }

    if (result.error) setError(result.error);
    else if (kind === "forgot") {
      setSuccess("Si existe una cuenta con ese correo, recibirás instrucciones para restablecer tu contraseña.");
    } else if (result.success) {
      setSuccess(result.success);
    }
  }

  async function handleResend() {
    setError(undefined);
    setSuccess(undefined);
    setResendPending(true);
    const result = await resendOtp(email);
    setResendPending(false);
    if (result.error) setError(result.error);
    else setSuccess(result.success ?? "Código reenviado.");
  }

  return (
    <form className="space-y-4" onSubmit={submit}>
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold">{title.title}</h1>
        {title.description ? <p className="text-sm text-text-secondary">{title.description}</p> : null}
      </div>

      {error ? (
        <Alert variant="danger" title="No fue posible continuar">
          {error}
        </Alert>
      ) : null}
      {success ? <Alert variant="success">{success}</Alert> : null}

      {kind === "register" || kind === "setup" ? (
        <FormField label="Nombre completo" htmlFor="fullName">
          <Input id="fullName" name="fullName" autoComplete="name" required />
        </FormField>
      ) : null}

      {kind !== "reset" && kind !== "setup" ? (
        <FormField label="Correo electrónico" htmlFor="email">
          <Input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            readOnly={kind === "verify" && Boolean(initialEmail)}
          />
        </FormField>
      ) : null}

      {kind === "verify" ? <OtpCodeInput required autoFocus /> : null}

      {kind === "login" || kind === "register" || kind === "reset" ? (
        <FormField
          label={kind === "reset" ? "Nueva contraseña" : "Contraseña"}
          htmlFor="password"
          hint="Mínimo 8 caracteres."
        >
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete={kind === "login" ? "current-password" : "new-password"}
            required
            minLength={8}
          />
        </FormField>
      ) : null}

      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? "Procesando…" : title.submit}
      </Button>

      {kind === "verify" ? (
        <div className="space-y-2 text-center text-sm text-text-secondary">
          <button
            type="button"
            className="text-brand-primary disabled:opacity-50"
            onClick={handleResend}
            disabled={resendPending || !email}
          >
            {resendPending ? "Reenviando…" : "Reenviar código"}
          </button>
          <p>
            <Link href="/login" className="text-brand-primary">
              Volver al inicio de sesión
            </Link>
          </p>
        </div>
      ) : null}

      {kind === "login" ? (
        <p className="text-center text-sm text-text-secondary">
          <Link href="/forgot-password" className="text-brand-primary">
            ¿Olvidaste tu contraseña?
          </Link>
          {" · "}
          <Link href="/register" className="text-brand-primary">
            Crear cuenta
          </Link>
        </p>
      ) : null}

      {kind === "register" ? (
        <p className="text-center text-sm text-text-secondary">
          ¿Ya tienes cuenta?{" "}
          <Link href="/login" className="text-brand-primary">
            Inicia sesión
          </Link>
        </p>
      ) : null}
    </form>
  );
}
