import "server-only";

import type { MessagingProvider, MessagingSendResult } from "@/lib/integrations/contracts/messaging";
import { providerError } from "@/lib/integrations/contracts/common";
import {
  WHATSAPP_MISSING_CREDENTIALS_ERROR,
  type WhatsAppCredentials,
} from "@/lib/integrations/whatsapp/env";
import { normalizeWhatsAppPhone } from "@/lib/integrations/whatsapp/phone";
import { logger } from "@/lib/observability/logger";

export type LiveWhatsAppCredentials = WhatsAppCredentials;

export type MessagingTemplateSendInput = {
  to: string;
  templateName: string;
  languageCode: string;
  /** Positional body params {{1}}, {{2}}, ... */
  bodyParameters?: string[];
};

function graphBase(version: string): string {
  return `https://graph.facebook.com/${encodeURIComponent(version)}`;
}

async function graphJson(
  url: string,
  init: RequestInit,
): Promise<{ ok: boolean; status: number; body: unknown }> {
  const res = await fetch(url, init);
  let body: unknown = null;
  try {
    body = await res.json();
  } catch {
    body = null;
  }
  return { ok: res.ok, status: res.status, body };
}

function extractMessageId(body: unknown): string | null {
  if (!body || typeof body !== "object" || Array.isArray(body)) return null;
  const messages = (body as { messages?: unknown }).messages;
  if (!Array.isArray(messages) || !messages[0] || typeof messages[0] !== "object") return null;
  const id = (messages[0] as { id?: unknown }).id;
  return typeof id === "string" && id.trim() ? id.trim() : null;
}

function extractErrorMessage(body: unknown): string {
  if (!body || typeof body !== "object" || Array.isArray(body)) return "WhatsApp Graph API error";
  const err = (body as { error?: { message?: unknown; code?: unknown } }).error;
  if (!err) return "WhatsApp Graph API error";
  const msg = typeof err.message === "string" ? err.message : "WhatsApp Graph API error";
  const code = err.code != null ? ` (${String(err.code)})` : "";
  return `${msg}${code}`.slice(0, 240);
}

/**
 * Live WhatsApp Cloud API adapter.
 * sendText / sendTemplate hit Graph; sync is a no-op (webhooks drive ingress).
 */
export function createLiveWhatsAppMessagingProvider(
  providerId: MessagingProvider["providerId"] = "whatsapp",
  creds: LiveWhatsAppCredentials,
): MessagingProvider & {
  sendTemplate(input: MessagingTemplateSendInput): Promise<MessagingSendResult>;
} {
  return {
    providerId,
    mode: "live",
    async connect(input) {
      return {
        ok: true,
        mode: "live",
        externalAccountId: creds.phoneNumberId || input.phoneNumberId,
        displayName: `WhatsApp · ${creds.phoneNumberId}`,
        credentialRef: input.credentialRef || "whatsapp-cloud-live",
      };
    },
    async health() {
      const started = Date.now();
      if (!creds.accessToken || !creds.phoneNumberId) {
        return {
          status: "unhealthy",
          mode: "live",
          checkedAt: new Date().toISOString(),
          latencyMs: Date.now() - started,
          message: WHATSAPP_MISSING_CREDENTIALS_ERROR,
          demo: false,
        };
      }
      const url = `${graphBase(creds.apiVersion)}/${encodeURIComponent(creds.phoneNumberId)}?fields=display_phone_number,verified_name`;
      const result = await graphJson(url, {
        method: "GET",
        headers: { Authorization: `Bearer ${creds.accessToken}` },
      });
      const latencyMs = Date.now() - started;
      if (!result.ok) {
        const unauthorized = result.status === 401 || result.status === 403;
        return {
          status: "unhealthy",
          mode: "live",
          checkedAt: new Date().toISOString(),
          latencyMs,
          message: unauthorized
            ? "WhatsApp unauthorized — check WHATSAPP_ACCESS_TOKEN / phone_number_id scopes"
            : extractErrorMessage(result.body).slice(0, 200),
          demo: false,
        };
      }
      return {
        status: "healthy",
        mode: "live",
        checkedAt: new Date().toISOString(),
        latencyMs,
        message: "WhatsApp Cloud API reachable",
        demo: false,
      };
    },
    async sync(input) {
      void input;
      return {
        ok: true,
        mode: "live",
        demo: false,
        processed: 0,
        inserted: 0,
        updated: 0,
        duplicates: 0,
        nextCursor: null,
        durationMs: 0,
        enqueues: [],
      };
    },
    async sendText(to, body) {
      if (!creds.accessToken || !creds.phoneNumberId) {
        throw new Error(WHATSAPP_MISSING_CREDENTIALS_ERROR);
      }
      const digits = normalizeWhatsAppPhone(to);
      if (!digits) throw new Error("Invalid WhatsApp recipient phone");
      const url = `${graphBase(creds.apiVersion)}/${encodeURIComponent(creds.phoneNumberId)}/messages`;
      const result = await graphJson(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${creds.accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          to: digits,
          type: "text",
          text: { preview_url: false, body: body.slice(0, 4096) },
        }),
      });
      if (!result.ok) {
        logger.warn("whatsapp.send_text.failed", {
          status: result.status,
          error: extractErrorMessage(result.body),
          to_suffix: digits.slice(-4),
        });
        throw new Error(extractErrorMessage(result.body));
      }
      const externalId = extractMessageId(result.body);
      if (!externalId) throw new Error("WhatsApp sendText: missing message id");
      return {
        externalId,
        to: digits,
        status: "sent",
        sentAt: new Date().toISOString(),
      };
    },
    async sendTemplate(input) {
      if (!creds.accessToken || !creds.phoneNumberId) {
        throw new Error(WHATSAPP_MISSING_CREDENTIALS_ERROR);
      }
      const digits = normalizeWhatsAppPhone(input.to);
      if (!digits) throw new Error("Invalid WhatsApp recipient phone");
      const components =
        input.bodyParameters && input.bodyParameters.length
          ? [
              {
                type: "body",
                parameters: input.bodyParameters.map((text) => ({ type: "text", text })),
              },
            ]
          : undefined;
      const url = `${graphBase(creds.apiVersion)}/${encodeURIComponent(creds.phoneNumberId)}/messages`;
      const result = await graphJson(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${creds.accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          to: digits,
          type: "template",
          template: {
            name: input.templateName,
            language: { code: input.languageCode },
            ...(components ? { components } : {}),
          },
        }),
      });
      if (!result.ok) {
        logger.warn("whatsapp.send_template.failed", {
          status: result.status,
          error: extractErrorMessage(result.body),
          template: input.templateName,
          to_suffix: digits.slice(-4),
        });
        throw new Error(extractErrorMessage(result.body));
      }
      const externalId = extractMessageId(result.body);
      if (!externalId) throw new Error("WhatsApp sendTemplate: missing message id");
      return {
        externalId,
        to: digits,
        status: "sent",
        sentAt: new Date().toISOString(),
      };
    },
  };
}

/** Narrow helper for sync failures without throwing through health. */
export function whatsappProviderSyncError(message: string) {
  return providerError("WHATSAPP_SEND_FAILED", message.slice(0, 240), { retryable: true });
}
