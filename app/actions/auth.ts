"use server";

import { redirect } from "next/navigation";
import { authPaths } from "@/config/auth";
import { routes } from "@/config/routes";
import { toUserMessage } from "@/lib/errors/to-user-message";
import { createClient } from "@/lib/supabase/server";
import { safeRedirectPath } from "@/lib/validation/redirect";
import { ValidationError } from "@/lib/errors";

export type AuthActionResult = { error?: string };
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validateCredentials(email: string, password: string): void {
  if (!emailPattern.test(email.trim())) throw new ValidationError("Ingresa un correo válido.");
  if (password.length < 8) throw new ValidationError("La contraseña debe tener al menos 8 caracteres.");
}

export async function login(email: string, password: string, next?: string): Promise<AuthActionResult> {
  try {
    validateCredentials(email, password);
    const supabase = await createClient();
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    if (error) return { error: error.message };
  } catch (error) {
    return { error: toUserMessage(error) };
  }
  redirect(safeRedirectPath(next, routes.app.dashboard));
}

export async function register(email: string, password: string, fullName: string): Promise<AuthActionResult> {
  try {
    validateCredentials(email, password);
    if (!fullName.trim()) throw new ValidationError("Ingresa tu nombre completo.");
    const supabase = await createClient();
    const { error } = await supabase.auth.signUp({ email: email.trim(), password, options: { data: { full_name: fullName.trim() } } });
    if (error) return { error: error.message };
  } catch (error) {
    return { error: toUserMessage(error) };
  }
  redirect(authPaths.verifyOtp);
}

export async function verifyOtp(email: string, token: string): Promise<AuthActionResult> {
  try {
    if (!emailPattern.test(email.trim()) || !token.trim()) throw new ValidationError("El código de verificación no es válido.");
    const supabase = await createClient();
    const { error } = await supabase.auth.verifyOtp({ email: email.trim(), token: token.trim(), type: "email" });
    if (error) return { error: error.message };
  } catch (error) {
    return { error: toUserMessage(error) };
  }
  redirect(routes.app.dashboard);
}

export async function forgotPassword(email: string): Promise<AuthActionResult> {
  try {
    if (!emailPattern.test(email.trim())) throw new ValidationError("Ingresa un correo válido.");
    const supabase = await createClient();
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim());
    if (error) return { error: error.message };
    return {};
  } catch (error) {
    return { error: toUserMessage(error) };
  }
}

export async function resetPassword(password: string): Promise<AuthActionResult> {
  try {
    if (password.length < 8) throw new ValidationError("La contraseña debe tener al menos 8 caracteres.");
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
