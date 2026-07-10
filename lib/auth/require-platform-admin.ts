import "server-only";
import { redirect } from "next/navigation";
import { getServerEnv } from "@/config/env";
import { authPaths } from "@/config/auth";
import { getUser } from "@/lib/auth/get-session";
import { getProfile } from "@/lib/auth/get-profile";
export async function requirePlatformAdmin() { const user = await getUser(); if (!user) redirect(authPaths.login); const profile = await getProfile(); const emails = new Set((getServerEnv().ADMIN_ALLOWED_EMAILS ?? "").split(",").map((email) => email.trim().toLowerCase()).filter(Boolean)); const hasRole = profile?.platform_role === "platform_owner" || profile?.platform_role === "platform_admin"; if (!hasRole && !emails.has(user.email?.toLowerCase() ?? "")) redirect("/unauthorized"); return user; }
