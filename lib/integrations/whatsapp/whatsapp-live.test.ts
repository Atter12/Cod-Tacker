import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  formatWhatsAppPhoneE164,
  normalizeWhatsAppPhone,
} from "@/lib/integrations/whatsapp/phone";
import { mapWhatsAppWebhookPayload } from "@/lib/integrations/whatsapp/map-webhook";
import {
  allowWhatsAppOpenWebhookAuth,
  signWhatsAppWebhookBody,
  verifyWhatsAppWebhookChallenge,
  verifyWhatsAppWebhookSignature,
} from "@/lib/integrations/whatsapp/webhook-auth";

describe("whatsapp phone normalize", () => {
  it("expands PE 9-digit mobiles", () => {
    assert.equal(normalizeWhatsAppPhone("999888777", "PE"), "51999888777");
    assert.equal(normalizeWhatsAppPhone("+51 999 888 777"), "51999888777");
    assert.equal(formatWhatsAppPhoneE164("999888777", "PE"), "+51999888777");
  });
});

describe("whatsapp webhook auth", () => {
  it("verifies hub challenge with matching token", () => {
    const ok = verifyWhatsAppWebhookChallenge({
      mode: "subscribe",
      verifyToken: "secret-verify",
      challenge: "12345",
      expectedVerifyToken: "secret-verify",
    });
    assert.equal(ok.ok, true);
    if (ok.ok) assert.equal(ok.challenge, "12345");
  });

  it("rejects mismatched verify token", () => {
    const bad = verifyWhatsAppWebhookChallenge({
      mode: "subscribe",
      verifyToken: "wrong",
      challenge: "12345",
      expectedVerifyToken: "secret-verify",
    });
    assert.equal(bad.ok, false);
  });

  it("validates X-Hub-Signature-256", () => {
    const body = '{"object":"whatsapp_business_account"}';
    const secret = "app-secret";
    const sig = signWhatsAppWebhookBody(secret, body);
    const ok = verifyWhatsAppWebhookSignature({
      rawBody: body,
      appSecret: secret,
      signatureHeader: sig,
    });
    assert.equal(ok.ok, true);

    const bad = verifyWhatsAppWebhookSignature({
      rawBody: body,
      appSecret: secret,
      signatureHeader: "sha256=deadbeef",
    });
    assert.equal(bad.ok, false);
  });

  it("requires secret in production posture", () => {
    assert.equal(allowWhatsAppOpenWebhookAuth({ VERCEL_ENV: "production" }), false);
    assert.equal(allowWhatsAppOpenWebhookAuth({ VERCEL_ENV: "preview" }), true);
    const blocked = verifyWhatsAppWebhookSignature({
      rawBody: "{}",
      appSecret: null,
      signatureHeader: null,
      allowOpenWhenSecretUnset: false,
    });
    assert.equal(blocked.ok, false);
  });
});

describe("whatsapp webhook mapping", () => {
  it("maps inbound text and status without requiring body logs", () => {
    const mapped = mapWhatsAppWebhookPayload({
      object: "whatsapp_business_account",
      entry: [
        {
          changes: [
            {
              value: {
                metadata: { phone_number_id: "pnid-1" },
                messages: [
                  {
                    from: "51999888777",
                    id: "wamid.INBOUND1",
                    type: "text",
                    text: { body: "SI confirmo" },
                  },
                ],
                statuses: [
                  {
                    id: "wamid.OUT1",
                    status: "delivered",
                  },
                ],
              },
            },
          ],
        },
      ],
    });
    assert.equal(mapped.ok, true);
    if (!mapped.ok) return;
    assert.equal(mapped.phoneNumberId, "pnid-1");
    assert.equal(mapped.events.length, 2);
    const inbound = mapped.events.find((e) => e.kind === "inbound");
    const status = mapped.events.find((e) => e.kind === "status");
    assert.ok(inbound && inbound.kind === "inbound");
    assert.equal(inbound.externalMessageId, "wamid.INBOUND1");
    assert.equal(inbound.phone, "51999888777");
    assert.equal(inbound.body, "SI confirmo");
    assert.ok(status && status.kind === "status");
    assert.equal(status.status, "delivered");
  });

  it("is idempotent-friendly: duplicate wamid left to job layer", () => {
    const mapped = mapWhatsAppWebhookPayload({
      object: "whatsapp_business_account",
      entry: [
        {
          changes: [
            {
              value: {
                metadata: { phone_number_id: "pnid-1" },
                messages: [
                  { from: "51999", id: "wamid.X", type: "text", text: { body: "hola" } },
                ],
              },
            },
          ],
        },
      ],
    });
    assert.equal(mapped.ok, true);
    if (!mapped.ok) return;
    assert.equal(mapped.events[0]?.kind, "inbound");
  });
});
