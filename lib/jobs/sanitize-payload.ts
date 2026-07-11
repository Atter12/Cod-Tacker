import type { Json } from "@/types/database.generated";

const SECRET_KEY_PATTERN =
  /(secret|password|passwd|token|api[_-]?key|access[_-]?key|private[_-]?key|credential|authorization|auth|bearer|client[_-]?secret|refresh[_-]?token|session)/i;

const REDACTED = "[REDACTED]";

function sanitizeValue(value: unknown, depth: number): unknown {
  if (depth > 12) return "[Truncated]";
  if (value == null) return value;
  if (Array.isArray(value)) {
    return value.slice(0, 200).map((item) => sanitizeValue(item, depth + 1));
  }
  if (typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
      if (SECRET_KEY_PATTERN.test(key)) {
        out[key] = REDACTED;
      } else {
        out[key] = sanitizeValue(child, depth + 1);
      }
    }
    return out;
  }
  if (typeof value === "string" && value.length > 8_000) {
    return `${value.slice(0, 8_000)}…[truncated]`;
  }
  return value;
}

/** Strip secret-looking keys and truncate oversized strings for admin UI display. */
export function sanitizePayloadForDisplay(payload: Json | null | undefined): Json {
  if (payload == null) return null;
  return sanitizeValue(payload, 0) as Json;
}

export function payloadLooksLarge(payload: Json | null | undefined, threshold = 2_000): boolean {
  if (payload == null) return false;
  try {
    return JSON.stringify(payload).length > threshold;
  } catch {
    return true;
  }
}
