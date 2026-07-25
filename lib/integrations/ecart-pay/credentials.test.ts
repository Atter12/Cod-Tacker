import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildEcartPayBasicAuthHeader,
  extractEcartPayTokenFromAuthResponse,
} from "@/lib/integrations/ecart-pay/auth-helpers";
import {
  fingerprintEcartPayPublicKey,
  parseEcartPayStoredPlaintext,
  serializeEcartPayApiKeysPack,
} from "@/lib/integrations/ecart-pay/credentials-parse";

describe("ecart-pay auth helpers", () => {
  it("builds Basic auth from public:private", () => {
    const header = buildEcartPayBasicAuthHeader("pub1", "priv1");
    assert.equal(header.startsWith("Basic "), true);
    const decoded = Buffer.from(header.slice("Basic ".length), "base64").toString("utf8");
    assert.equal(decoded, "pub1:priv1");
  });

  it("extracts token from flat or nested response", () => {
    assert.equal(extractEcartPayTokenFromAuthResponse({ token: " abc " }), "abc");
    assert.equal(
      extractEcartPayTokenFromAuthResponse({ data: { token: "nested" } }),
      "nested",
    );
    assert.equal(extractEcartPayTokenFromAuthResponse({}), null);
  });
});

describe("ecart-pay credentials parse", () => {
  it("round-trips api keys v2 JSON pack", () => {
    const json = serializeEcartPayApiKeysPack({
      publicKey: "pub-test-key",
      privateKey: "priv-test-key",
    });
    const unpacked = parseEcartPayStoredPlaintext(json);
    assert.equal(unpacked.kind, "api_keys");
    if (unpacked.kind !== "api_keys") return;
    assert.equal(unpacked.publicKey, "pub-test-key");
    assert.equal(unpacked.privateKey, "priv-test-key");
  });

  it("treats legacy bearer plaintext as legacy_bearer", () => {
    const unpacked = parseEcartPayStoredPlaintext("eyJlegacy.bearer.token");
    assert.equal(unpacked.kind, "legacy_bearer");
    if (unpacked.kind !== "legacy_bearer") return;
    assert.equal(unpacked.token, "eyJlegacy.bearer.token");
  });

  it("fingerprints public key stably", () => {
    assert.equal(
      fingerprintEcartPayPublicKey("pub-abc"),
      fingerprintEcartPayPublicKey("pub-abc"),
    );
    assert.notEqual(
      fingerprintEcartPayPublicKey("pub-abc"),
      fingerprintEcartPayPublicKey("pub-xyz"),
    );
  });
});
