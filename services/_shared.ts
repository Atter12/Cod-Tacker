import type { SupabaseClient } from "@supabase/supabase-js";
import { AppError, ValidationError } from "@/lib/errors";
import type { Database } from "@/types/database.generated";

export type DatabaseClient = SupabaseClient<Database>;

export function requireValue(value: string, message = "Falta un valor requerido."): string {
  const trimmed = value.trim();
  if (!trimmed) throw new ValidationError(message);
  return trimmed;
}

export function throwQueryError(error: { message: string } | null): void {
  if (error) throw new AppError("DATABASE_ERROR", 500, "No se pudo completar la operación solicitada.", { cause: error });
}
