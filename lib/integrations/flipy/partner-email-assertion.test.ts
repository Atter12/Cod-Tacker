import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { describe, it } from "node:test";
import { signPartnerEmailAssertion } from "@/lib/integrations/flipy/partner-email-assertion";

describe("partner email assertion JWT", () => {
  it("signs HS256 JWT with required claims", () => {
    const secret = "test-shared-secret";
    const token = signPartnerEmailAssertion({
      secret,
      externalStoreId: "store-uuid-1",
      email: "Ops@Tienda.pe",
      partnerId: "codtracked",
      emailVerifiedAt: "2026-08-27T12:00:00.000Z",
      ttlSeconds: 600,
    });

    const [headerB64, payloadB64, signature] = token.split(".");
    assert.ok(headerB64 && payloadB64 && signature);

    const header = JSON.parse(Buffer.from(headerB64, "base64url").toString("utf8"));
    assert.equal(header.alg, "HS256");

    const payload = JSON.parse(Buffer.from(payloadB64, "base64url").toString("utf8"));
    assert.equal(payload.iss, "codtracked");
    assert.equal(payload.aud, "flipy");
    assert.equal(payload.sub, "store-uuid-1");
    assert.equal(payload.email, "ops@tienda.pe");
    assert.equal(payload.partnerId, "codtracked");
    assert.equal(payload.emailVerifiedAt, "2026-08-27T12:00:00.000Z");
    assert.ok(typeof payload.exp === "number");

    const expectedSig = createHmac("sha256", secret)
      .update(`${headerB64}.${payloadB64}`, "utf8")
      .digest("base64url");
    assert.equal(signature, expectedSig);
  });
});
