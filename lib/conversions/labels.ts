import type { Enums, Json, Tables } from "@/types/database.generated";

export type ConversionDeliveryStatus = Enums<"delivery_status">;
export type ConversionEventRow = Tables<"conversion_events">;

/** Merchant-facing conversion outcome (not raw delivery_status). */
export type ConversionOutcome = "sent" | "failed" | "dry_run" | "pending" | "cancelled";

function asRecord(value: Json | null | undefined): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

/** Detect dry-run / live mode from custom_data or response_payload (Sandro CAPI). */
export function readConversionMode(
  event: Pick<ConversionEventRow, "custom_data" | "response_payload">,
): "dry_run" | "live" | null {
  for (const bag of [event.custom_data, event.response_payload]) {
    const record = asRecord(bag);
    if (!record) continue;
    if (record.dry_run === true || record.mode === "dry_run") return "dry_run";
    if (record.mode === "live" || record.live === true) return "live";
  }
  return null;
}

export function conversionOutcome(
  event: Pick<ConversionEventRow, "status" | "custom_data" | "response_payload">,
): ConversionOutcome {
  if (readConversionMode(event) === "dry_run") return "dry_run";

  switch (event.status) {
    case "sent":
    case "acknowledged":
      return "sent";
    case "failed":
    case "rejected":
      return "failed";
    case "cancelled":
      return "cancelled";
    case "queued":
    case "sending":
    case "retrying":
    default:
      return "pending";
  }
}

const OUTCOME_LABELS: Record<ConversionOutcome, string> = {
  sent: "Enviado",
  failed: "Falló",
  dry_run: "Prueba",
  pending: "En proceso",
  cancelled: "Cancelado",
};

export function labelConversionOutcome(outcome: ConversionOutcome): string {
  return OUTCOME_LABELS[outcome];
}

export function labelConversionPlatform(platform: string): string {
  switch (platform) {
    case "meta":
      return "Meta";
    case "tiktok":
      return "TikTok";
    default:
      return platform;
  }
}

export function labelConversionEventName(eventName: string): string {
  const lower = eventName.toLowerCase();
  if (lower === "purchase" || lower === "compra") return "Compra";
  if (lower.includes("purchase")) return "Compra";
  return eventName;
}

/** Last meaningful attempt time for UI. */
export function conversionLastAttemptAt(
  event: Pick<ConversionEventRow, "sent_at" | "acknowledged_at" | "updated_at" | "event_time">,
): string {
  return event.sent_at || event.acknowledged_at || event.updated_at || event.event_time;
}

/**
 * Merchant-safe explanation for failed / rejected conversion sends.
 * Avoids raw pixel / HTTP jargon.
 */
export function friendlyConversionError(raw: string | null | undefined): string | null {
  if (!raw?.trim()) return null;
  const lower = raw.toLowerCase();

  if (
    lower.includes("mock") &&
    (lower.includes("disabled") || lower.includes("no están habilitadas") || lower.includes("habilitad"))
  ) {
    return "Las pruebas de conversión no están activas en este entorno.";
  }
  if (lower.includes("token") || lower.includes("oauth") || lower.includes("unauthorized") || lower.includes("401")) {
    return "La conexión con la plataforma de anuncios no es válida o expiró. Revisá Integraciones.";
  }
  if (lower.includes("pixel") || lower.includes("dataset") || lower.includes("404")) {
    return "No encontramos el píxel o el conjunto de datos configurado. Revisá la configuración de la tienda.";
  }
  if (lower.includes("permission") || lower.includes("forbidden") || lower.includes("403")) {
    return "La cuenta de anuncios no tiene permiso para enviar este evento.";
  }
  if (lower.includes("rate") || lower.includes("429") || lower.includes("throttle")) {
    return "La plataforma limitó el envío por un momento. Se reintentará automáticamente.";
  }
  if (lower.includes("timeout") || lower.includes("network") || lower.includes("econn")) {
    return "No hubo respuesta de la plataforma. Se reintentará en breve.";
  }
  if (/\b(400|422)\b/.test(lower) || lower.includes("invalid")) {
    return "Los datos del evento fueron rechazados. Revisá el pedido o la configuración de conversiones.";
  }
  if (lower.includes("dry_run") || lower.includes("dry run")) {
    return "Fue una prueba interna: no se envió a la plataforma de anuncios.";
  }

  // Strip obvious technical noise; keep short Spanish-ish text if already friendly.
  const cleaned = raw
    .replace(/\b(HTTP\/?\d*|status|code)\b[:\s]*/gi, "")
    .replace(/\b[45]\d{2}\b/g, "")
    .replace(/\s+/g, " ")
    .trim();

  if (!cleaned || cleaned.length > 160 || /[{}[\]\\]/.test(cleaned)) {
    return "No se pudo avisar a la plataforma de anuncios. Revisá Integraciones o reintentá más tarde.";
  }
  return cleaned;
}

export function conversionOutcomeHint(outcome: ConversionOutcome): string {
  switch (outcome) {
    case "sent":
      return "La plataforma de anuncios recibió el aviso de conversión.";
    case "failed":
      return "No se pudo enviar el aviso. Podés revisar la conexión o esperar un reintento.";
    case "dry_run":
      return "Simulación interna: no se envió nada a Meta ni TikTok.";
    case "pending":
      return "El envío está en cola o reintentándose.";
    case "cancelled":
      return "Este envío de conversión se canceló.";
  }
}
