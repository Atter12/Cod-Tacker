import "server-only";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
export async function getSession() { const supabase = await createClient(); const { data: { session }, error } = await supabase.auth.getSession(); if (error) throw error; return session; }
export async function getUser(): Promise<User | null> { const supabase = await createClient(); const { data: { user }, error } = await supabase.auth.getUser(); if (error) return null; return user; }
