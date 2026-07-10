import "server-only";
import { createClient } from "@/lib/supabase/server";
import { getUser } from "@/lib/auth/get-session";
export type Profile = { id: string; email: string | null; platform_role: string | null; full_name: string | null };
export async function getProfile(): Promise<Profile | null> { const user = await getUser(); if (!user) return null; const supabase = await createClient(); const { data, error } = await supabase.from("profiles").select("id, email, platform_role, full_name").eq("id", user.id).maybeSingle(); if (error) throw error; return data as Profile | null; }
