/**
 * WhatsApp mock scenarios and template variable helpers (Sprint 8).
 */

export const WHATSAPP_REPLY_SCENARIOS = [
  { id: "confirm", label: "Cliente confirma", body: "SI confirmo el pedido" },
  { id: "reject", label: "Cliente rechaza", body: "NO quiero el pedido" },
  { id: "ambiguous", label: "Respuesta ambigua", body: "tal vez mañana" },
  { id: "no_response", label: "Sin respuesta (timeout)", body: "" },
] as const;

export type WhatsappDeliveryScenario = "delivered_read" | "failed_retryable" | "failed_permanent";

const PLACEHOLDER_RE = /\{\{(\w+)\}\}/g;

export function extractTemplateVariables(body: string): string[] {
  const found = new Set<string>();
  for (const m of body.matchAll(PLACEHOLDER_RE)) {
    if (m[1]) found.add(m[1]);
  }
  return [...found];
}

export function renderTemplate(
  body: string,
  vars: Record<string, string>,
): { text: string; missing: string[] } {
  const missing: string[] = [];
  const text = body.replace(PLACEHOLDER_RE, (_, key: string) => {
    if (vars[key] == null || vars[key] === "") {
      missing.push(key);
      return `{{${key}}}`;
    }
    return vars[key]!;
  });
  return { text, missing: [...new Set(missing)] };
}

export function inferConfirmationFromBody(
  body: string,
): "confirmed" | "rejected" | "pending" | null {
  const t = body.trim().toLowerCase();
  if (!t) return null;
  if (/^(si|sí|confirmo|ok|dale|yes)\b/.test(t) || t.includes("confirmo")) return "confirmed";
  if (/^(no|cancel|rechaz|no quiero)\b/.test(t)) return "rejected";
  return "pending";
}
