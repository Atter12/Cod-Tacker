import "server-only";
import { createClient } from "@supabase/supabase-js";
import { getPublicEnv, getServerEnv } from "@/config/env";
import type { Database } from "@/types/database.generated";
export function createAdminClient() { const env = getPublicEnv(); const serviceRoleKey = getServerEnv().SUPABASE_SERVICE_ROLE_KEY; if (!serviceRoleKey) throw new Error("SUPABASE_SERVICE_ROLE_KEY is required for admin operations."); return createClient<Database>(env.NEXT_PUBLIC_SUPABASE_URL, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } }); }
