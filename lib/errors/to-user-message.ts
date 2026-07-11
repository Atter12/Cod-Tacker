import { AppError } from "@/lib/errors/AppError";

const AUTH_SAFE_MESSAGES: Record<string, string> = {
  "invalid login credentials": "Correo o contraseña incorrectos.",
  "email not confirmed": "Debes confirmar tu correo antes de continuar.",
  "user already registered": "Ya existe una cuenta con este correo.",
  "signup requires a valid password": "La contraseña no cumple los requisitos.",
  "password should be at least": "La contraseña es demasiado corta.",
  "token has expired": "El código ha expirado. Solicita uno nuevo.",
  "otp has expired": "El código ha expirado. Solicita uno nuevo.",
  "invalid otp": "El código ingresado no es válido.",
  "for security purposes": "Espera un momento antes de intentarlo de nuevo.",
};

function looksSensitive(message: string): boolean {
  const lower = message.toLowerCase();
  return (
    lower.includes("jwt") ||
    lower.includes("service_role") ||
    lower.includes("apikey") ||
    lower.includes("api key") ||
    lower.includes("secret") ||
    lower.includes("password") ||
    lower.includes("stack") ||
    lower.includes("permission denied") ||
    lower.includes("violates row-level") ||
    lower.includes("duplicate key") ||
    lower.includes("foreign key") ||
    lower.includes("relation ") ||
    lower.includes("column ")
  );
}

function mapAuthOrKnownMessage(message: string): string | null {
  const lower = message.toLowerCase();
  for (const [needle, safe] of Object.entries(AUTH_SAFE_MESSAGES)) {
    if (lower.includes(needle)) return safe;
  }
  return null;
}

/**
 * Converts any thrown/returned error into a Spanish message safe for UI.
 * Never forwards raw database, stack, or credential details to the client.
 */
export function toUserMessage(error: unknown): string {
  if (error instanceof AppError) return error.safeMessage;

  if (typeof error === "string") {
    const mapped = mapAuthOrKnownMessage(error);
    if (mapped) return mapped;
    if (looksSensitive(error) || error.length > 180) {
      return "Ocurrió un error inesperado. Inténtalo nuevamente.";
    }
    return error;
  }

  if (error && typeof error === "object") {
    const record = error as { message?: unknown; code?: unknown; status?: unknown };
    const message = typeof record.message === "string" ? record.message : "";
    if (message) {
      const mapped = mapAuthOrKnownMessage(message);
      if (mapped) return mapped;
      // PostgREST / Postgres codes — never echo raw details
      if (typeof record.code === "string" && /^[0-9A-Z]{2,}/.test(record.code)) {
        if (record.code === "23505") return "Ya existe un registro con esos datos.";
        return "No se pudo completar la operación. Inténtalo nuevamente.";
      }
      if (looksSensitive(message)) {
        return "No se pudo completar la operación. Inténtalo nuevamente.";
      }
      // Short Auth API messages are often already user-facing
      if (message.length <= 120 && !looksSensitive(message)) return message;
    }
  }

  return "Ocurrió un error inesperado. Inténtalo nuevamente.";
}
