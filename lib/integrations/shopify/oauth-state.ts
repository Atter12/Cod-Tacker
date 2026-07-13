import "server-only";

import { randomBytes } from "node:crypto";
import { decryptSecret, encryptSecret } from "@/lib/crypto/secret-box";

export type ShopifyOAuthStatePayload = {
  v: 1;
  nonce: string;
  agencyId: string;
  storeId: string;
  userId: string;
  shop: string;
  agencySlug: string;
  storeSlug: string;
  exp: number;
};

const STATE_TTL_MS = 15 * 60 * 1000;

export function createShopifyOAuthState(
  input: Omit<ShopifyOAuthStatePayload, "v" | "nonce" | "exp">,
): string {
  const payload: ShopifyOAuthStatePayload = {
    v: 1,
    nonce: randomBytes(16).toString("hex"),
    ...input,
    exp: Date.now() + STATE_TTL_MS,
  };
  return encryptSecret(JSON.stringify(payload));
}

export function parseShopifyOAuthState(state: string): ShopifyOAuthStatePayload {
  const raw = decryptSecret(state);
  const parsed = JSON.parse(raw) as ShopifyOAuthStatePayload;
  if (parsed?.v !== 1 || !parsed.agencyId || !parsed.storeId || !parsed.shop) {
    throw new Error("Estado OAuth inválido.");
  }
  if (Date.now() > parsed.exp) {
    throw new Error("El enlace de autorización expiró. Vuelve a conectar Shopify.");
  }
  return parsed;
}
