/** Normalize and validate a Shopify shop domain (*.myshopify.com). */

const MYSHOPIFY_RE = /^[a-z0-9][a-z0-9-]*\.myshopify\.com$/i;

export function normalizeShopifyShopDomain(raw: string): string | null {
  let value = raw.trim().toLowerCase();
  if (!value) return null;

  value = value.replace(/^https?:\/\//, "");
  value = value.split("/")[0] ?? value;
  value = value.split("?")[0] ?? value;

  if (!value.includes(".")) {
    value = `${value}.myshopify.com`;
  }

  if (!MYSHOPIFY_RE.test(value)) return null;
  return value;
}

export function assertShopifyShopDomain(raw: string): string {
  const shop = normalizeShopifyShopDomain(raw);
  if (!shop) {
    throw new Error("Dominio Shopify inválido. Usa el formato tienda.myshopify.com.");
  }
  return shop;
}
