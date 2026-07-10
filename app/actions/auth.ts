"use server";

import { redirect } from "next/navigation";
import { authCallbackUrl, authPaths } from "@/config/auth";
import { getPublicEnv } from "@/config/env";
import { routes } from "@/config/routes";
import { ValidationError } from "@/lib/errors";
import { toUserMessage } from "@/lib/errors/to-user-message";
import { createClient } from "@/lib/supabase/server";
import { safeRedirectPath } from "@/lib/validation/redirect";

export type AuthActionResult = { error?: string; success?: string };
/** OTP is only used to confirm email ownership during account creation. */
export type OtpPurpose = "signup";

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const otpPattern = /^\d{6}$/;

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function validateEmail(email: string): string {
  const value = normalizeEmail(email);
  if (!emailPattern.test(value)) throw new ValidationError("Ingresa un correo válido.");
  return value;
}

function validatePassword(password: string): void {
  if (password.length < 8) throw new ValidationError("La contraseña debe tener al menos 8 caracteres.");
}

function validateOtpCode(token: string): string {
  const value = token.trim();
  if (!otpPattern.test(value)) throw new ValidationError("Ingresa el código de 6 dígitos que recibiste por correo.");
  return value;
}

function verifyOtpPath(email: string): string {
  const params = new URLSearchParams({ email, purpose: "signup" });
  return `${authPaths.verifyOtp}?${params.toString()}`;
}

export async function login(email: string, password: string, next?: string): Promise<AuthActionResult> {
  try {
    const normalizedEmail = validateEmail(email);
    validatePassword(password);
    const supabase = await createClient();
    const { error } = await supabase.auth.signInWithPassword({ email: normalizedEmail, password });
    if (error) return { error: error.message };
  } catch (error) {
    return { error: toUserMessage(error) };
  }
  redirect(safeRedirectPath(next, routes.app.dashboard));
}

export async function register(email: string, password: string, fullName: string): Promise<AuthActionResult> {
  let normalizedEmail = "";
  try {
    normalizedEmail = validateEmail(email);
    validatePassword(password);
    if (!fullName.trim()) throw new ValidationError("Ingresa tu nombre completo.");
    const supabase = await createClient();
    const appUrl = getPublicEnv().NEXT_PUBLIC_APP_URL;
    const { data, error } = await supabase.auth.signUp({
      email: normalizedEmail,
      password,
      options: {
        data: { full_name: fullName.trim() },
        emailRedirectTo: authCallbackUrl(appUrl, routes.app.dashboard),
      },
    });
    if (error) return { error: error.message };
    if (data.session) redirect(routes.app.dashboard);
  } catch (error) {
    return { error: toUserMessage(error) };
  }
  redirect(verifyOtpPath(normalizedEmail));
}

export async function verifyOtp(email: string, token: string): Promise<AuthActionResult> {
  try {
    const normalizedEmail = validateEmail(email);
    const code = validateOtpCode(token);
    const supabase = await createClient();
    const { error } = await supabase.auth.verifyOtp({
      email: normalizedEmail,
      token: code,
      type: "signup",
    });
    if (error) return { error: error.message };
  } catch (error) {
    return { error: toUserMessage(error) };
  }
  redirect(routes.app.dashboard);
}

export async function resendOtp(email: string): Promise<AuthActionResult> {
  try {
    const normalizedEmail = validateEmail(email);
    const supabase = await createClient();
    const appUrl = getPublicEnv().NEXT_PUBLIC_APP_URL;
    const { error } = await supabase.auth.resend({
      type: "signup",
      email: normalizedEmail,
      options: { emailRedirectTo: authCallbackUrl(appUrl, routes.app.dashboard) },
    });
    if (error) return { error: error.message };
    return { success: "Te enviamos un nuevo código de 6 dígitos. Revisa tu correo." };
  } catch (error) {
    return { error: toUserMessage(error) };
  }
}

export async function forgotPassword(email: string): Promise<AuthActionResult> {
  try {
    const normalizedEmail = validateEmail(email);
    const supabase = await createClient();
    const appUrl = getPublicEnv().NEXT_PUBLIC_APP_URL;
    const { error } = await supabase.auth.resetPasswordForEmail(normalizedEmail, {
      redirectTo: authCallbackUrl(appUrl, authPaths.resetPassword),
    });
    if (error) return { error: error.message };
    return {};
  } catch (error) {
    return { error: toUserMessage(error) };
  }
}

export async function resetPassword(password: string): Promise<AuthActionResult> {
  try {
    validatePassword(password);
    const supabase = await createClient();
    const { error } = await supabase.auth.updateUser({ password });
    if (error) return { error: error.message };
  } catch (error) {
    return { error: toUserMessage(error) };
  }
  redirect(routes.app.dashboard);
}

export async function logout(): Promise<never> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect(authPaths.login);
}
