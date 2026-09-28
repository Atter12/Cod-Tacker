import { createHmac, timingSafeEqual } from "node:crypto";
import { normalizeShopifyShopDomain } from "@/lib/integrations/shopify/domain";

export type ShopifySessionClaims = {
  shop: string;
  sub: string;
};

type JwtClaims = {
  aud?: string | string[];
  dest?: string;
  exp?: number;
  nbf?: number;
  sub?: string;
};

function decodeBase64Url(value: string): Buffer {
  const pad = value.length % 4 === 0 ? "" : "=".repeat(4 - (value.length % 4));
  return Buffer.from(value.replace(/-/g, "+").replace(/_/g, "/") + pad, "base64");
}

function audienceMatches(aud: JwtClaims["aud"], clientId: string): boolean {
  if (typeof aud === "string") return aud === clientId;
  return Array.isArray(aud) && aud.includes(clientId);
}

/**
 * Verifies an embedded-app session token from App Bridge (`shopify.idToken()`).
 * Signed with the app client secret. `dest` is the shop the merchant is in.
 */
export function verifyShopifySessionToken(
  token: string,
  options: { clientId: string; clientSecret: string; now?: number },
): ShopifySessionClaims {
  const parts = token.split(".");
  if (parts.length !== 3 || !parts[0] || !parts[1] || !parts[2]) {
    throw new Error("Token de sesión inválido.");
  }
  const [headerPart, payloadPart, signaturePart] = parts;

  let header: { alg?: string };
  try {
    header = JSON.parse(decodeBase64Url(headerPart).toString("utf8")) as { alg?: string };
  } catch {
    throw new Error("Token de sesión inválido.");
  }
  if (header.alg !== "HS256") {
    throw new Error("Algoritmo de sesión no soportado.");
  }

  const expected = createHmac("sha256", options.clientSecret)
    .update(`${headerPart}.${payloadPart}`)
    .digest();
  const actual = decodeBase64Url(signaturePart);
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) {
    throw new Error("Firma de sesión inválida.");
  }

  let claims: JwtClaims;
  try {
    claims = JSON.parse(decodeBase64Url(payloadPart).toString("utf8")) as JwtClaims;
  } catch {
    throw new Error("Token de sesión inválido.");
  }

  const now = options.now ?? Math.floor(Date.now() / 1000);
  if (!audienceMatches(claims.aud, options.clientId)) {
    throw new Error("Audiencia de sesión inválida.");
  }
  if (typeof claims.exp !== "number" || claims.exp < now - 5) {
    throw new Error("Sesión expirada.");
  }
  if (typeof claims.nbf === "number" && claims.nbf > now + 5) {
    throw new Error("Sesión aún no válida.");
  }
  if (!claims.sub) {
    throw new Error("Sesión sin usuario.");
  }

  let hostname = "";
  try {
    hostname = claims.dest ? new URL(claims.dest).hostname : "";
  } catch {
    hostname = "";
  }
  const shop = normalizeShopifyShopDomain(hostname);
  if (!shop) {
    throw new Error("Sesión sin tienda.");
  }

  return { shop, sub: claims.sub };
}

export function shopifySessionTokenExchangeBody(input: {
  clientId: string;
  clientSecret: string;
  sessionToken: string;
}) {
  return {
    client_id: input.clientId,
    client_secret: input.clientSecret,
    grant_type: "urn:ietf:params:oauth:grant-type:token-exchange",
    subject_token: input.sessionToken,
    subject_token_type: "urn:ietf:params:oauth:token-type:id_token",
    requested_token_type: "urn:shopify:params:oauth:token-type:offline-access-token",
    expiring: 1,
  };
}
