"use server";

import { revalidatePath } from "next/cache";
import { routes } from "@/config/routes";
import { requireUser } from "@/lib/auth/require-user";
import { toUserMessage } from "@/lib/errors/to-user-message";
import { ValidationError } from "@/lib/errors";
import { createClient } from "@/lib/supabase/server";

export type ProfileInput = { fullName: string; avatarUrl?: string | null };
export type ProfileActionResult = { error?: string };

function validateProfile(input: ProfileInput): void {
  if (!input.fullName.trim()) throw new ValidationError("Ingresa tu nombre completo.");
}

export async function updateProfile(input: ProfileInput): Promise<ProfileActionResult> {
  try {
    validateProfile(input);
    const user = await requireUser();
    const supabase = await createClient();
    const { error } = await supabase.from("profiles").update({ full_name: input.fullName.trim(), avatar_url: input.avatarUrl ?? null }).eq("id", user.id);
    if (error) return { error: error.message };
    revalidatePath(routes.app.dashboard);
    return {};
  } catch (error) {
    return { error: toUserMessage(error) };
  }
}

export async function completeAccountSetup(input: ProfileInput): Promise<ProfileActionResult> {
  const result = await updateProfile(input);
  if (result.error) return result;
  revalidatePath(routes.auth.accountSetup);
  return {};
}
