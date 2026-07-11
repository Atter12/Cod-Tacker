"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { ArrowRight, Eye, EyeOff } from "lucide-react";
import { OtpCodeInput } from "@/components/auth/OtpCodeInput";
import { GoogleLoginPlaceholder } from "@/components/auth/GoogleLoginPlaceholder";
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
import { cn } from "@/lib/utils/cn";

type Kind = "login" | "register" | "verify" | "forgot" | "reset" | "setup";
type Appearance = "default" | "login";

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
  next,
  appearance = "default",
}: {
  kind: Kind;
  email?: string;
  purpose?: OtpPurpose;
  next?: string;
  appearance?: Appearance;
}) {
  const [error, setError] = useState<string>();
  const [success, setSuccess] = useState<string>();
  const [pending, setPending] = useState(false);
  const [resendPending, setResendPending] = useState(false);
  const [email, setEmail] = useState(initialEmail);
  const [showPassword, setShowPassword] = useState(false);
  const title = copy[kind];
  const isLoginExperience = appearance === "login" && kind === "login";

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
        result = await login(formEmail, String(data.get("password") ?? ""), next);
      } else if (kind === "register") {
        result = await register(
          formEmail,
          String(data.get("password") ?? ""),
          String(data.get("fullName") ?? ""),
        );
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
      setSuccess(
        "Si existe una cuenta con ese correo, recibirás instrucciones para restablecer tu contraseña.",
      );
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

  const inputClass = isLoginExperience
    ? "h-12 rounded-[11px] border-[rgba(76,139,170,0.28)] bg-[#0B1A2C] text-[#F8FAFC] placeholder:text-[#64748B] focus:border-[rgba(34,211,238,0.55)] focus:ring-[rgba(34,211,238,0.35)]"
    : undefined;

  const labelClass = isLoginExperience
    ? "text-[12.5px] font-semibold text-[#CBD5E1] [&_span]:text-[#64748B]"
    : undefined;

  return (
    <form className="space-y-4" onSubmit={submit} noValidate={false}>
      <div className="space-y-1">
        <h1
          className={
            isLoginExperience
              ? "text-[30px] font-bold tracking-tight text-[#F8FAFC]"
              : "text-2xl font-semibold"
          }
        >
          {isLoginExperience ? "Bienvenido de nuevo" : title.title}
        </h1>
        {isLoginExperience ? (
          <p className="pt-1 text-[13.5px] leading-relaxed text-[#94A3B8]">
            Accede a CODTracked y selecciona la tienda que vas a gestionar.
          </p>
        ) : title.description ? (
          <p className="text-sm text-text-secondary">{title.description}</p>
        ) : null}
      </div>

      {isLoginExperience ? (
        <div className="space-y-4 pt-1">
          <GoogleLoginPlaceholder />
          <div className="flex items-center gap-3">
            <span className="h-px flex-1 bg-[rgba(76,139,170,0.28)]" aria-hidden="true" />
            <span className="text-[11px] uppercase tracking-wide text-[#64748B]">
              o ingresa con correo
            </span>
            <span className="h-px flex-1 bg-[rgba(76,139,170,0.28)]" aria-hidden="true" />
          </div>
        </div>
      ) : null}

      <div className="space-y-4" aria-live="polite">
        {error ? (
          <Alert variant="danger" title="No fue posible continuar">
            {error}
          </Alert>
        ) : null}
        {success ? <Alert variant="success">{success}</Alert> : null}
      </div>

      {kind === "register" || kind === "setup" ? (
        <FormField label="Nombre completo" htmlFor="fullName">
          <Input id="fullName" name="fullName" autoComplete="name" required />
        </FormField>
      ) : null}

      {kind !== "reset" && kind !== "setup" ? (
        <FormField label="Correo electrónico" htmlFor="email" className={labelClass}>
          <Input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            readOnly={kind === "verify" && Boolean(initialEmail)}
            className={inputClass}
          />
        </FormField>
      ) : null}

      {kind === "verify" ? <OtpCodeInput required autoFocus /> : null}

      {kind === "login" || kind === "register" || kind === "reset" ? (
        <FormField
          label={kind === "reset" ? "Nueva contraseña" : "Contraseña"}
          htmlFor="password"
          hint="Mínimo 8 caracteres."
          className={labelClass}
        >
          <div className="relative">
            <Input
              id="password"
              name="password"
              type={isLoginExperience && showPassword ? "text" : "password"}
              autoComplete={kind === "login" ? "current-password" : "new-password"}
              required
              minLength={8}
              className={cn(inputClass, isLoginExperience && "pr-11")}
            />
            {isLoginExperience ? (
              <button
                type="button"
                className="absolute inset-y-0 right-0 grid w-11 place-items-center text-[#94A3B8] outline-none hover:text-[#F8FAFC] focus-visible:text-[#22D3EE]"
                aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                onClick={() => setShowPassword((value) => !value)}
              >
                {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
            ) : null}
          </div>
        </FormField>
      ) : null}

      <Button
        type="submit"
        className={
          isLoginExperience
            ? "h-12 w-full rounded-[11px] bg-[#19C7B5] text-[15px] font-bold text-[#042F2E] transition-colors duration-150 hover:bg-[#14B8A6] focus-visible:ring-[#22D3EE] disabled:opacity-60"
            : "w-full"
        }
        disabled={pending}
        size={isLoginExperience ? "lg" : "md"}
      >
        {pending ? (
          "Procesando…"
        ) : isLoginExperience ? (
          <>
            Entrar a CODTracked
            <ArrowRight className="size-4" aria-hidden />
          </>
        ) : (
          title.submit
        )}
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
        isLoginExperience ? (
          <div className="flex flex-wrap items-center justify-between gap-3 pt-1 text-[12.5px]">
            <Link
              href="/forgot-password"
              className="font-medium text-[#22D3EE] underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(34,211,238,0.55)]"
            >
              ¿Olvidaste tu contraseña?
            </Link>
            <Link
              href="/register"
              className="font-medium text-[#19C7B5] underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(34,211,238,0.55)]"
            >
              Crear cuenta
            </Link>
          </div>
        ) : (
          <p className="text-center text-sm text-text-secondary">
            <Link href="/forgot-password" className="text-brand-primary">
              ¿Olvidaste tu contraseña?
            </Link>
            {" · "}
            <Link href="/register" className="text-brand-primary">
              Crear cuenta
            </Link>
          </p>
        )
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
