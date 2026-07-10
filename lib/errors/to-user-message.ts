import { AppError } from "@/lib/errors/AppError";
export function toUserMessage(error: unknown): string { return error instanceof AppError ? error.safeMessage : "Ocurrió un error inesperado. Inténtalo nuevamente."; }
