import { z } from "zod";

const optionalSecret = z
  .string()
  .trim()
  .transform((value) => value || undefined)
  .optional();

const optionalFlag = z
  .string()
  .trim()
  .transform((value) => value || undefined)
  .optional();

const publicEnvSchema = z.object({
  NEXT_PUBLIC_APP_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  NEXT_PUBLIC_DEFAULT_LOCALE: z.string().min(1).default("es-PE"),
  NEXT_PUBLIC_DEFAULT_TIMEZONE: z.string().min(1).default("America/Lima"),
});

const optionalEnum = <T extends z.ZodTypeAny>(schema: T) =>
  z.preprocess((value) => {
    if (typeof value !== "string") return undefined;
    const trimmed = value.trim();
    return trimmed.length ? trimmed : undefined;
  }, schema.optional());

const serverEnvSchema = publicEnvSchema.extend({
  SUPABASE_SERVICE_ROLE_KEY: optionalSecret,
  ADMIN_ALLOWED_EMAILS: optionalSecret,
  ENCRYPTION_KEY: optionalSecret,
  INTERNAL_JOB_SECRET: optionalSecret,
  CRON_SECRET: optionalSecret,
  WEBHOOK_GLOBAL_SECRET: optionalSecret,
  /** mock | live — required explicitly in production when resolving providers. */
  INTEGRATION_MODE: optionalEnum(z.enum(["mock", "live"])),
  /** When "true", mock adapters may run. Defaults to enabled outside production. */
  MOCK_INTEGRATIONS_ENABLED: optionalFlag,
});

export type PublicEnv = z.infer<typeof publicEnvSchema>;
export type ServerEnv = z.infer<typeof serverEnvSchema>;
export type IntegrationMode = "mock" | "live";

export function getPublicEnv(): PublicEnv {
  return publicEnvSchema.parse({
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    NEXT_PUBLIC_DEFAULT_LOCALE: process.env.NEXT_PUBLIC_DEFAULT_LOCALE,
    NEXT_PUBLIC_DEFAULT_TIMEZONE: process.env.NEXT_PUBLIC_DEFAULT_TIMEZONE,
  });
}

export function getServerEnv(): ServerEnv {
  return serverEnvSchema.parse({ ...process.env });
}

/**
 * Resolves integration mode without exposing secrets to the client.
 * - Development/test: defaults to `mock` when unset.
 * - Production: requires explicit `INTEGRATION_MODE`.
 */
export function resolveIntegrationMode(env: ServerEnv = getServerEnv()): IntegrationMode {
  if (env.INTEGRATION_MODE) return env.INTEGRATION_MODE;
  if (process.env.NODE_ENV === "production") {
    throw new Error("INTEGRATION_MODE must be set explicitly in production (mock|live).");
  }
  return "mock";
}

export function areMockIntegrationsEnabled(env: ServerEnv = getServerEnv()): boolean {
  if (env.MOCK_INTEGRATIONS_ENABLED === "false") return false;
  if (env.MOCK_INTEGRATIONS_ENABLED === "true") return true;
  return resolveIntegrationMode(env) === "mock";
}
