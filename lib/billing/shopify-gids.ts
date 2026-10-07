/** Normalize Shopify App / Shop GIDs for Partner API variables. */

export function normalizeShopifyAppGid(raw: string): string {
  const value = raw.trim();
  if (value.startsWith("gid://shopify/App/")) return value;
  if (/^\d+$/.test(value)) return `gid://shopify/App/${value}`;
  throw new Error("SHOPIFY_APP_GID debe ser gid://shopify/App/{id} o un id numérico.");
}

export function normalizeShopifyShopGid(raw: string): string | null {
  const value = raw.trim();
  if (!value) return null;
  if (value.startsWith("gid://shopify/Shop/")) return value;
  if (/^\d+$/.test(value)) return `gid://shopify/Shop/${value}`;
  const match = value.match(/Shop\/(\d+)/i);
  if (match?.[1]) return `gid://shopify/Shop/${match[1]}`;
  return null;
}
