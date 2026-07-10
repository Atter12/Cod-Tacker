import "server-only";
import { redirect } from "next/navigation";
import { authPaths } from "@/config/auth";
import { getUser } from "@/lib/auth/get-session";
export async function requireUser() { const user = await getUser(); if (!user) redirect(authPaths.login); return user; }
