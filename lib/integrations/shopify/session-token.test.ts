import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { describe, it } from "node:test";
import { shopifySessionTokenExchangeBody, verifyShopifySessionToken } from "@/lib/integrations/shopify/session-token";

const CLIENT_ID = "client-id";
const SECRET = "client-secret";

function sign(payload: Record<string, unknown>, secret = SECRET): string {
  const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = createHmac("sha256", secret).update(`${header}.${body}`).digest("base64url");
  return `${header}.${body}.${signature}`;
}

const NOW = 1_700_000_000;

function claims(overrides: Record<string, unknown> = {}) {
  return {
    aud: CLIENT_ID,
    dest: "https://demo.myshopify.com",
    sub: "user-1",
    exp: NOW + 60,
    nbf: NOW - 5,
    iat: NOW - 5,
    ...overrides,
  };
}

describe("shopify session token exchange", () => {
  it("asks Shopify for an expiring offline token", () => {
    const body = shopifySessionTokenExchangeBody({
      clientId: "id",
      clientSecret: "secret",
      sessionToken: "jwt",
    });
    assert.equal(body.grant_type, "urn:ietf:params:oauth:grant-type:token-exchange");
    assert.equal(body.subject_token, "jwt");
    assert.equal(body.requested_token_type, "urn:shopify:params:oauth:token-type:offline-access-token");
    assert.equal(body.expiring, 1);
  });
});
describe("shopify session token", () => {
  it("accepts a token for the shop in dest", () => {
    const session = verifyShopifySessionToken(sign(claims()), {
      clientId: CLIENT_ID,
      clientSecret: SECRET,
      now: NOW,
    });
    assert.equal(session.shop, "demo.myshopify.com");
    assert.equal(session.sub, "user-1");
  });

  it("rejects a bad signature, audience, or expiry", () => {
    assert.throws(
      () =>
        verifyShopifySessionToken(sign(claims(), "other-secret"), {
          clientId: CLIENT_ID,
          clientSecret: SECRET,
          now: NOW,
        }),
      /Firma/,
    );
    assert.throws(
      () =>
        verifyShopifySessionToken(sign(claims({ aud: "other" })), {
          clientId: CLIENT_ID,
          clientSecret: SECRET,
          now: NOW,
        }),
      /Audiencia/,
    );
    assert.throws(
      () =>
        verifyShopifySessionToken(sign(claims({ exp: NOW - 30 })), {
          clientId: CLIENT_ID,
          clientSecret: SECRET,
          now: NOW,
        }),
      /expirada/,
    );
  });
});
