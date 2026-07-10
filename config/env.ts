import { z } from "zod";

const optionalSecret = z.string().trim().transform((value) => value || undefined).optional();
const publicEnvSchema = z.object({
  NEXT_PUBLIC_APP_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  NEXT_PUBLIC_DEFAULT_LOCALE: z.string().min(1).default("es-PE"),
  NEXT_PUBLIC_DEFAULT_TIMEZONE: z.string().min(1).default("America/Lima"),
});
const serverEnvSchema = publicEnvSchema.extend({
  SUPABASE_SERVICE_ROLE_KEY: optionalSecret, ADMIN_ALLOWED_EMAILS: optionalSecret, ENCRYPTION_KEY: optionalSecret,
  INTERNAL_JOB_SECRET: optionalSecret, CRON_SECRET: optionalSecret, WEBHOOK_GLOBAL_SECRET: optionalSecret,
});
export type PublicEnv = z.infer<typeof publicEnvSchema>;
export type ServerEnv = z.infer<typeof serverEnvSchema>;
export function getPublicEnv(): PublicEnv { return publicEnvSchema.parse({ NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL, NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, NEXT_PUBLIC_DEFAULT_LOCALE: process.env.NEXT_PUBLIC_DEFAULT_LOCALE, NEXT_PUBLIC_DEFAULT_TIMEZONE: process.env.NEXT_PUBLIC_DEFAULT_TIMEZONE }); }
export function getServerEnv(): ServerEnv { return serverEnvSchema.parse({ ...process.env }); }
