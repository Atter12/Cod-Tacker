/**
 * Explicit empty-state copy when Shopify (or the order source) did not send contact fields.
 */

export type ShopifyContactField = "name" | "email" | "phone";

function isShopifySource(sourceName?: string | null): boolean {
  if (!sourceName) return true;
  return sourceName === "shopify" || sourceName === "shopify.mock";
}

export function missingShopifyContactLabel(
  field: ShopifyContactField,
  sourceName?: string | null,
): string {
  if (isShopifySource(sourceName)) {
    switch (field) {
      case "name":
        return "Shopify no envió nombre";
      case "email":
        return "Shopify no envió email";
      case "phone":
        return "Shopify no envió teléfono";
    }
  }
  switch (field) {
    case "name":
      return "Sin nombre";
    case "email":
      return "Sin email";
    case "phone":
      return "Sin teléfono";
  }
}

export function displayShopifyContact(
  value: string | null | undefined,
  field: ShopifyContactField,
  sourceName?: string | null,
): string {
  const trimmed = value?.trim();
  return trimmed ? trimmed : missingShopifyContactLabel(field, sourceName);
}
