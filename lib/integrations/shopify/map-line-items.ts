/** Normalized line item shared by webhook + GraphQL sync jobs. */
export type ShopifyMappedLineItem = {
  external_line_item_id: string;
  external_product_id?: string;
  external_variant_id?: string;
  title: string;
  sku?: string;
  quantity: number;
  unit_price: number;
  total_discount: number;
  total_price: number;
  product_title?: string;
  variant_title?: string;
  vendor?: string;
  image_url?: string;
};

export type ShopifyRestLineItem = {
  id?: number | string | null;
  product_id?: number | string | null;
  variant_id?: number | string | null;
  title?: string | null;
  name?: string | null;
  sku?: string | null;
  quantity?: number | null;
  price?: string | number | null;
  total_discount?: string | number | null;
  vendor?: string | null;
  variant_title?: string | null;
};

export type ShopifyGraphqlMoneySet = {
  shopMoney?: { amount?: string | null; currencyCode?: string | null } | null;
} | null;

export type ShopifyGraphqlLineItemNode = {
  id: string;
  title?: string | null;
  name?: string | null;
  quantity?: number | null;
  sku?: string | null;
  variantTitle?: string | null;
  originalUnitPriceSet?: ShopifyGraphqlMoneySet;
  discountedTotalSet?: ShopifyGraphqlMoneySet;
  totalDiscountSet?: ShopifyGraphqlMoneySet;
  variant?: {
    id?: string | null;
    title?: string | null;
    sku?: string | null;
    price?: string | null;
    product?: {
      id?: string | null;
      title?: string | null;
      vendor?: string | null;
      featuredImage?: { url?: string | null } | null;
    } | null;
  } | null;
};

function shopifyGidToExternalId(gidOrId: string): string {
  const trimmed = gidOrId.trim();
  const match = /\/(\d+)\s*$/.exec(trimmed);
  if (match?.[1]) return match[1];
  if (/^\d+$/.test(trimmed)) return trimmed;
  return trimmed;
}

function parseMoney(value: string | number | null | undefined): number {
  if (typeof value === "number" && Number.isFinite(value)) return Math.max(0, value);
  if (typeof value === "string") {
    const n = Number.parseFloat(value);
    return Number.isFinite(n) ? Math.max(0, n) : 0;
  }
  return 0;
}

function cleanText(value: string | null | undefined, max = 500): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  return trimmed.slice(0, max);
}

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

export function mapRestLineItems(
  lineItems: ShopifyRestLineItem[] | null | undefined,
): ShopifyMappedLineItem[] {
  if (!Array.isArray(lineItems)) return [];
  const out: ShopifyMappedLineItem[] = [];

  for (const item of lineItems) {
    const externalId = item.id != null ? String(item.id) : undefined;
    const title = cleanText(item.title) ?? cleanText(item.name);
    const quantity = typeof item.quantity === "number" && item.quantity > 0 ? item.quantity : 0;
    if (!externalId || !title || quantity <= 0) continue;

    const unit_price = parseMoney(item.price);
    const total_discount = parseMoney(item.total_discount);
    const total_price = roundMoney(Math.max(0, unit_price * quantity - total_discount));
    const productId = item.product_id != null ? String(item.product_id) : undefined;
    const variantId = item.variant_id != null ? String(item.variant_id) : undefined;

    out.push({
      external_line_item_id: externalId,
      ...(productId && productId !== "0" ? { external_product_id: productId } : {}),
      ...(variantId && variantId !== "0" ? { external_variant_id: variantId } : {}),
      title,
      ...(cleanText(item.sku, 120) ? { sku: cleanText(item.sku, 120) } : {}),
      quantity,
      unit_price,
      total_discount,
      total_price,
      ...(cleanText(item.vendor) ? { vendor: cleanText(item.vendor), product_title: title } : {}),
      ...(cleanText(item.variant_title) ? { variant_title: cleanText(item.variant_title) } : {}),
    });
  }

  return out;
}

export function mapGraphqlLineItems(
  edges: Array<{ node: ShopifyGraphqlLineItemNode }> | null | undefined,
): ShopifyMappedLineItem[] {
  if (!Array.isArray(edges)) return [];
  const out: ShopifyMappedLineItem[] = [];

  for (const edge of edges) {
    const node = edge?.node;
    if (!node?.id) continue;
    const title = cleanText(node.title) ?? cleanText(node.name);
    const quantity = typeof node.quantity === "number" && node.quantity > 0 ? node.quantity : 0;
    if (!title || quantity <= 0) continue;

    const unit_price = parseMoney(node.originalUnitPriceSet?.shopMoney?.amount ?? node.variant?.price);
    const total_discount = parseMoney(node.totalDiscountSet?.shopMoney?.amount);
    const discountedTotal = node.discountedTotalSet?.shopMoney?.amount;
    const total_price =
      discountedTotal != null
        ? parseMoney(discountedTotal)
        : roundMoney(Math.max(0, unit_price * quantity - total_discount));

    const external_product_id = node.variant?.product?.id
      ? shopifyGidToExternalId(node.variant.product.id)
      : undefined;
    const external_variant_id = node.variant?.id
      ? shopifyGidToExternalId(node.variant.id)
      : undefined;
    const sku = cleanText(node.sku, 120) ?? cleanText(node.variant?.sku, 120);
    const product_title = cleanText(node.variant?.product?.title);
    const variant_title = cleanText(node.variantTitle) ?? cleanText(node.variant?.title);
    const vendor = cleanText(node.variant?.product?.vendor);
    const image_url = cleanText(node.variant?.product?.featuredImage?.url, 2000);

    out.push({
      external_line_item_id: shopifyGidToExternalId(node.id),
      ...(external_product_id ? { external_product_id } : {}),
      ...(external_variant_id ? { external_variant_id } : {}),
      title,
      ...(sku ? { sku } : {}),
      quantity,
      unit_price,
      total_discount,
      total_price,
      ...(product_title ? { product_title } : {}),
      ...(variant_title ? { variant_title } : {}),
      ...(vendor ? { vendor } : {}),
      ...(image_url ? { image_url } : {}),
    });
  }

  return out;
}
