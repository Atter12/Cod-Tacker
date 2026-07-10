"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { Alert, Button, FormField, Input } from "@/components/ui";
import { forgotPassword, login, register, resetPassword, verifyOtp } from "@/app/actions/auth";
import { completeAccountSetup } from "@/app/actions/profile";

type Kind = "login" | "register" | "verify" | "forgot" | "reset" | "setup";

const copy: Record<Kind, { title: string; submit: string }> = {
  login: { title: "Inicia sesión", submit: "Entrar" },
  register: { title: "Crea tu cuenta", submit: "Crear cuenta" },
  verify: { title: "Verifica tu correo", submit: "Verificar código" },
  forgot: { title: "Recupera tu contraseña", submit: "Enviar instrucciones" },
  reset: { title: "Nueva contraseña", submit: "Actualizar contraseña" },
  setup: { title: "Completa tu perfil", submit: "Continuar" },
};

export function AuthForm({ kind }: { kind: Kind }) {
  const [error, setError] = useState<string>();
  const [success, setSuccess] = useState<string>();
  const [pending, setPending] = useState(false);
  const title = copy[kind];
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(undefined); setSuccess(undefined); setPending(true);
    const data = new FormData(event.currentTarget);
    let result: { error?: string };
    if (kind === "login") result = await login(String(data.get("email") ?? ""), String(data.get("password") ?? ""));
    else if (kind === "register") result = await register(String(data.get("email") ?? ""), String(data.get("password") ?? ""), String(data.get("fullName") ?? ""));
    else if (kind === "verify") result = await verifyOtp(String(data.get("email") ?? ""), String(data.get("token") ?? ""));
    else if (kind === "forgot") result = await forgotPassword(String(data.get("email") ?? ""));
    else if (kind === "reset") result = await resetPassword(String(data.get("password") ?? ""));
    else result = await completeAccountSetup({ fullName: String(data.get("fullName") ?? "") });
    setPending(false);
    if (result.error) setError(result.error);
    else if (kind === "forgot") setSuccess("Si existe una cuenta con ese correo, recibirás instrucciones para restablecer tu contraseña.");
  }
  return <form className="space-y-4" onSubmit={submit}>
    <h1 className="text-2xl font-semibold">{title.title}</h1>
    {error ? <Alert variant="danger" title="No fue posible continuar">{error}</Alert> : null}
    {success ? <Alert variant="success">{success}</Alert> : null}
    {kind === "register" || kind === "setup" ? <FormField label="Nombre completo" htmlFor="fullName"><Input id="fullName" name="fullName" autoComplete="name" required /></FormField> : null}
    {kind !== "reset" && kind !== "setup" ? <FormField label="Correo electrónico" htmlFor="email"><Input id="email" name="email" type="email" autoComplete="email" required /></FormField> : null}
    {kind === "verify" ? <FormField label="Código de verificación" htmlFor="token"><Input id="token" name="token" inputMode="numeric" required /></FormField> : null}
    {kind === "login" || kind === "register" || kind === "reset" ? <FormField label={kind === "reset" ? "Nueva contraseña" : "Contraseña"} htmlFor="password" hint="Mínimo 8 caracteres."><Input id="password" name="password" type="password" autoComplete={kind === "login" ? "current-password" : "new-password"} required minLength={8} /></FormField> : null}
    <Button type="submit" className="w-full" disabled={pending}>{pending ? "Procesando…" : title.submit}</Button>
    {kind === "login" ? <p className="text-center text-sm text-text-secondary"><Link href="/forgot-password" className="text-brand-primary">¿Olvidaste tu contraseña?</Link> · <Link href="/register" className="text-brand-primary">Crear cuenta</Link></p> : null}
  </form>;
}
