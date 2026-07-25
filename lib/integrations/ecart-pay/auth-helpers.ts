/** Pure helpers for Ecart Pay authorization (safe for unit tests). */

export function buildEcartPayBasicAuthHeader(publicKey: string, privateKey: string): string {
  const raw = `${publicKey.trim()}:${privateKey.trim()}`;
  return `Basic ${Buffer.from(raw, "utf8").toString("base64")}`;
}

export function extractEcartPayTokenFromAuthResponse(json: unknown): string | null {
  if (!json || typeof json !== "object" || Array.isArray(json)) return null;
  const bag = json as Record<string, unknown>;
  if (typeof bag.token === "string" && bag.token.trim()) return bag.token.trim();
  const data = bag.data;
  if (data && typeof data === "object" && !Array.isArray(data)) {
    const inner = data as Record<string, unknown>;
    if (typeof inner.token === "string" && inner.token.trim()) return inner.token.trim();
  }
  return null;
}
