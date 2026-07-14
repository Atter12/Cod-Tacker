import { PermanentJobError } from "@/lib/jobs/errors";
import type { JobsAdminClient } from "@/lib/jobs/types";
import type { ShopifyMappedLineItem } from "@/lib/integrations/shopify/map-line-items";
import type { Json } from "@/types/database.generated";

async function upsertProduct(input: {
  admin: JobsAdminClient;
  storeId: string;
  item: ShopifyMappedLineItem;
}): Promise<string | null> {
  const externalId = input.item.external_product_id;
  if (!externalId) return null;

  const title = input.item.product_title ?? input.item.title;
  const existing = await input.admin
    .from("products")
    .select("id")
    .eq("store_id", input.storeId)
    .eq("external_product_id", externalId)
    .limit(1)
    .maybeSingle();
  if (existing.error) {
    throw new PermanentJobError("DATABASE_ERROR", "No se pudo buscar el producto Shopify.");
  }

  const now = new Date().toISOString();
  const patch = {
    title,
    ...(input.item.vendor ? { vendor: input.item.vendor } : {}),
    ...(input.item.image_url ? { image_url: input.item.image_url } : {}),
    updated_at: now,
  };

  if (existing.data) {
    const update = await input.admin
      .from("products")
      .update(patch)
      .eq("id", existing.data.id)
      .eq("store_id", input.storeId);
    if (update.error) {
      throw new PermanentJobError("DATABASE_ERROR", "No se pudo actualizar el producto Shopify.");
    }
    return existing.data.id;
  }

  const insert = await input.admin
    .from("products")
    .insert({
      store_id: input.storeId,
      external_product_id: externalId,
      title,
      vendor: input.item.vendor ?? null,
      image_url: input.item.image_url ?? null,
      metadata: { source: "shopify", synced_at: now } as Json,
      created_at: now,
      updated_at: now,
    })
    .select("id")
    .single();
  if (insert.error || !insert.data) {
    throw new PermanentJobError("DATABASE_ERROR", "No se pudo crear el producto Shopify.");
  }
  return insert.data.id;
}

async function upsertVariant(input: {
  admin: JobsAdminClient;
  storeId: string;
  productId: string;
  item: ShopifyMappedLineItem;
}): Promise<string | null> {
  const externalId = input.item.external_variant_id;
  if (!externalId) return null;

  const existing = await input.admin
    .from("product_variants")
    .select("id")
    .eq("store_id", input.storeId)
    .eq("external_variant_id", externalId)
    .limit(1)
    .maybeSingle();
  if (existing.error) {
    throw new PermanentJobError("DATABASE_ERROR", "No se pudo buscar la variante Shopify.");
  }

  const now = new Date().toISOString();
  const patch = {
    product_id: input.productId,
    ...(input.item.sku ? { sku: input.item.sku } : {}),
    ...(input.item.variant_title ? { title: input.item.variant_title } : {}),
    price: input.item.unit_price,
    updated_at: now,
  };

  if (existing.data) {
    const update = await input.admin
      .from("product_variants")
      .update(patch)
      .eq("id", existing.data.id)
      .eq("store_id", input.storeId);
    if (update.error) {
      throw new PermanentJobError("DATABASE_ERROR", "No se pudo actualizar la variante Shopify.");
    }
    return existing.data.id;
  }

  const insert = await input.admin
    .from("product_variants")
    .insert({
      store_id: input.storeId,
      product_id: input.productId,
      external_variant_id: externalId,
      sku: input.item.sku ?? null,
      title: input.item.variant_title ?? null,
      price: input.item.unit_price,
      metadata: { source: "shopify", synced_at: now } as Json,
      created_at: now,
      updated_at: now,
    })
    .select("id")
    .single();
  if (insert.error || !insert.data) {
    throw new PermanentJobError("DATABASE_ERROR", "No se pudo crear la variante Shopify.");
  }
  return insert.data.id;
}

/**
 * Reconcile order_items for a Shopify order: upsert by external_line_item_id, delete removed.
 * Also light-upserts products / variants when external ids are present.
 */
export async function syncShopifyOrderItems(input: {
  admin: JobsAdminClient;
  storeId: string;
  orderId: string;
  lineItems: ShopifyMappedLineItem[];
}): Promise<void> {
  const { admin, storeId, orderId, lineItems } = input;

  const existing = await admin
    .from("order_items")
    .select("id, external_line_item_id")
    .eq("store_id", storeId)
    .eq("order_id", orderId);
  if (existing.error) {
    throw new PermanentJobError("DATABASE_ERROR", "No se pudieron leer los ítems del pedido.");
  }

  const byExternal = new Map(
    (existing.data ?? [])
      .filter((row) => row.external_line_item_id)
      .map((row) => [row.external_line_item_id as string, row.id]),
  );
  const seen = new Set<string>();
  const now = new Date().toISOString();

  for (const item of lineItems) {
    seen.add(item.external_line_item_id);
    const productId = await upsertProduct({ admin, storeId, item });
    const variantId = productId
      ? await upsertVariant({ admin, storeId, productId, item })
      : null;

    const row = {
      store_id: storeId,
      order_id: orderId,
      external_line_item_id: item.external_line_item_id,
      product_id: productId,
      variant_id: variantId,
      sku: item.sku ?? null,
      title: item.title,
      quantity: item.quantity,
      unit_price: item.unit_price,
      total_discount: item.total_discount,
      total_price: item.total_price,
      metadata: {
        source: "shopify",
        synced_at: now,
        ...(item.vendor ? { vendor: item.vendor } : {}),
        ...(item.variant_title ? { variant_title: item.variant_title } : {}),
      } as Json,
    };

    const existingId = byExternal.get(item.external_line_item_id);
    if (existingId) {
      const update = await admin
        .from("order_items")
        .update(row)
        .eq("id", existingId)
        .eq("store_id", storeId)
        .eq("order_id", orderId);
      if (update.error) {
        throw new PermanentJobError("DATABASE_ERROR", "No se pudo actualizar un ítem del pedido.");
      }
    } else {
      const insert = await admin.from("order_items").insert(row);
      if (insert.error) {
        throw new PermanentJobError("DATABASE_ERROR", "No se pudo crear un ítem del pedido.");
      }
    }
  }

  const toDelete = (existing.data ?? [])
    .filter((row) => {
      if (!row.external_line_item_id) return lineItems.length > 0;
      return !seen.has(row.external_line_item_id);
    })
    .map((row) => row.id);

  if (toDelete.length) {
    const del = await admin
      .from("order_items")
      .delete()
      .eq("store_id", storeId)
      .eq("order_id", orderId)
      .in("id", toDelete);
    if (del.error) {
      throw new PermanentJobError("DATABASE_ERROR", "No se pudieron eliminar ítems obsoletos.");
    }
  }
}
