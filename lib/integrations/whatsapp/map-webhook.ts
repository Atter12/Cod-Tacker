import { normalizeWhatsAppPhone } from "@/lib/integrations/whatsapp/phone";

export type WhatsAppInboundMapped = {
  kind: "inbound";
  phoneNumberId: string;
  phone: string;
  externalMessageId: string;
  body: string;
  messageType: string;
};

export type WhatsAppStatusMapped = {
  kind: "status";
  phoneNumberId: string;
  externalMessageId: string;
  status: "sent" | "delivered" | "read" | "failed";
  errorCode?: string;
  errorMessage?: string;
  retryable?: boolean;
};

export type WhatsAppMappedEvent = WhatsAppInboundMapped | WhatsAppStatusMapped;

function mapMetaStatus(raw: string): WhatsAppStatusMapped["status"] | null {
  switch (raw) {
    case "sent":
    case "delivered":
    case "read":
    case "failed":
      return raw;
    default:
      return null;
  }
}

/**
 * Map Meta Cloud API webhook JSON → normalized job payloads.
 * Does not log message bodies (PII).
 */
export function mapWhatsAppWebhookPayload(json: unknown): {
  ok: true;
  phoneNumberId: string | null;
  events: WhatsAppMappedEvent[];
} | { ok: false; error: string } {
  if (!json || typeof json !== "object" || Array.isArray(json)) {
    return { ok: false, error: "payload_not_object" };
  }
  const root = json as Record<string, unknown>;
  if (root.object != null && root.object !== "whatsapp_business_account") {
    return { ok: false, error: "unexpected_object" };
  }

  const entry = Array.isArray(root.entry) ? root.entry : [];
  const events: WhatsAppMappedEvent[] = [];
  let phoneNumberId: string | null = null;

  for (const ent of entry) {
    if (!ent || typeof ent !== "object" || Array.isArray(ent)) continue;
    const changes = Array.isArray((ent as { changes?: unknown }).changes)
      ? ((ent as { changes: unknown[] }).changes)
      : [];
    for (const change of changes) {
      if (!change || typeof change !== "object" || Array.isArray(change)) continue;
      const value = (change as { value?: unknown }).value;
      if (!value || typeof value !== "object" || Array.isArray(value)) continue;
      const bag = value as Record<string, unknown>;
      const meta = bag.metadata;
      if (meta && typeof meta === "object" && !Array.isArray(meta)) {
        const pid = (meta as { phone_number_id?: unknown }).phone_number_id;
        if (typeof pid === "string" && pid.trim()) {
          phoneNumberId = pid.trim();
        }
      }

      const messages = Array.isArray(bag.messages) ? bag.messages : [];
      for (const msg of messages) {
        if (!msg || typeof msg !== "object" || Array.isArray(msg)) continue;
        const m = msg as Record<string, unknown>;
        const id = typeof m.id === "string" ? m.id.trim() : "";
        const from = typeof m.from === "string" ? m.from.trim() : "";
        if (!id || !from) continue;
        let body = "";
        const type = typeof m.type === "string" ? m.type : "text";
        if (type === "text" && m.text && typeof m.text === "object" && !Array.isArray(m.text)) {
          const b = (m.text as { body?: unknown }).body;
          body = typeof b === "string" ? b : "";
        } else if (
          type === "button" &&
          m.button &&
          typeof m.button === "object" &&
          !Array.isArray(m.button)
        ) {
          const b = (m.button as { text?: unknown; payload?: unknown }).text;
          const p = (m.button as { payload?: unknown }).payload;
          body = typeof b === "string" ? b : typeof p === "string" ? p : "";
        } else if (
          type === "interactive" &&
          m.interactive &&
          typeof m.interactive === "object" &&
          !Array.isArray(m.interactive)
        ) {
          const interactive = m.interactive as Record<string, unknown>;
          const btn = interactive.button_reply;
          const list = interactive.list_reply;
          if (btn && typeof btn === "object" && !Array.isArray(btn)) {
            const t = (btn as { title?: unknown }).title;
            body = typeof t === "string" ? t : "";
          } else if (list && typeof list === "object" && !Array.isArray(list)) {
            const t = (list as { title?: unknown }).title;
            body = typeof t === "string" ? t : "";
          }
        }
        events.push({
          kind: "inbound",
          phoneNumberId: phoneNumberId ?? "",
          phone: normalizeWhatsAppPhone(from),
          externalMessageId: id,
          body,
          messageType: type,
        });
      }

      const statuses = Array.isArray(bag.statuses) ? bag.statuses : [];
      for (const st of statuses) {
        if (!st || typeof st !== "object" || Array.isArray(st)) continue;
        const s = st as Record<string, unknown>;
        const id = typeof s.id === "string" ? s.id.trim() : "";
        const statusRaw = typeof s.status === "string" ? s.status : "";
        const status = mapMetaStatus(statusRaw);
        if (!id || !status) continue;
        let errorCode: string | undefined;
        let errorMessage: string | undefined;
        let retryable: boolean | undefined;
        const errors = Array.isArray(s.errors) ? s.errors : [];
        if (errors[0] && typeof errors[0] === "object" && !Array.isArray(errors[0])) {
          const err = errors[0] as Record<string, unknown>;
          if (typeof err.code === "number") errorCode = String(err.code);
          if (typeof err.title === "string") errorMessage = err.title.slice(0, 500);
          // Meta 130429 / rate limits often retryable
          retryable = errorCode === "130429" || errorCode === "131048";
        }
        events.push({
          kind: "status",
          phoneNumberId: phoneNumberId ?? "",
          externalMessageId: id,
          status,
          errorCode,
          errorMessage,
          retryable,
        });
      }
    }
  }

  return { ok: true, phoneNumberId, events };
}
