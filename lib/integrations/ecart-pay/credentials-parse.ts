/** Pure parse/fingerprint helpers for Ecart Pay credentials (unit-test safe). */

export const ECART_PAY_KEYS_PACK_VERSION = 2 as const;

export type EcartPayApiKeys = {
  publicKey: string;
  privateKey: string;
};

export type EcartPayStoredCredentials =
  | { kind: "api_keys"; publicKey: string; privateKey: string }
  | { kind: "legacy_bearer"; token: string };

type KeysPackV2 = {
  v: typeof ECART_PAY_KEYS_PACK_VERSION;
  publicKey: string;
  privateKey: string;
};

function isKeysPackV2(value: unknown): value is KeysPackV2 {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const bag = value as Record<string, unknown>;
  return (
    bag.v === ECART_PAY_KEYS_PACK_VERSION &&
    typeof bag.publicKey === "string" &&
    bag.publicKey.trim().length > 0 &&
    typeof bag.privateKey === "string" &&
    bag.privateKey.trim().length > 0
  );
}

export function serializeEcartPayApiKeysPack(keys: EcartPayApiKeys): string {
  const pack: KeysPackV2 = {
    v: ECART_PAY_KEYS_PACK_VERSION,
    publicKey: keys.publicKey.trim(),
    privateKey: keys.privateKey.trim(),
  };
  return JSON.stringify(pack);
}

export function parseEcartPayStoredPlaintext(plain: string): EcartPayStoredCredentials {
  const trimmed = plain.trim();
  if (!trimmed) throw new Error("empty_ecart_secret");

  if (trimmed.startsWith("{")) {
    try {
      const parsed: unknown = JSON.parse(trimmed);
      if (isKeysPackV2(parsed)) {
        return {
          kind: "api_keys",
          publicKey: parsed.publicKey.trim(),
          privateKey: parsed.privateKey.trim(),
        };
      }
    } catch {
      /* fall through to legacy bearer */
    }
  }

  return { kind: "legacy_bearer", token: trimmed };
}

export function fingerprintEcartPayPublicKey(publicKey: string): string {
  let hash = 0;
  const s = publicKey.trim();
  for (let i = 0; i < s.length; i += 1) {
    hash = (hash * 31 + s.charCodeAt(i)) | 0;
  }
  return `ecart:${(hash >>> 0).toString(16)}`;
}
