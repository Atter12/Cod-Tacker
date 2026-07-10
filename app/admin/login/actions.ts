"use server";

import { redirect } from "next/navigation";
import { getServerEnv } from "@/config/env";
import { routes } from "@/config/routes";
import { createClient } from "@/lib/supabase/server";

export async function loginToAdmin(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  if (!email || !password) redirect(`${routes.admin.login}?error=credentials`);

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) redirect(`${routes.admin.login}?error=credentials`);

  const { data: profile } = await supabase
    .from("profiles")
    .select("platform_role")
    .eq("id", (await supabase.auth.getUser()).data.user?.id ?? "")
    .maybeSingle();
  const allowedEmails = new Set(
    (getServerEnv().ADMIN_ALLOWED_EMAILS ?? "")
      .split(",")
      .map((value) => value.trim().toLowerCase())
      .filter(Boolean),
  );
  const isAdmin = profile?.platform_role === "platform_admin" || allowedEmails.has(email.toLowerCase());

  redirect(isAdmin ? routes.admin.overview : "/unauthorized");
}
