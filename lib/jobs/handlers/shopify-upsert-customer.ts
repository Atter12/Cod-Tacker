import { PermanentJobError } from "@/lib/jobs/errors";
import type { JobsAdminClient } from "@/lib/jobs/types";
import type { ShopifyMappedCustomer } from "@/lib/integrations/shopify/map-customer";
import type { Json } from "@/types/database.generated";

/**
 * Upsert by external_customer_id → email → phone (no DB unique yet).
 * Returns null when there is nothing identifiable to persist.
 */
export async function upsertShopifyCustomer(input: {
  admin: JobsAdminClient;
  storeId: string;
  customer: ShopifyMappedCustomer;
}): Promise<string | null> {
  const { admin, storeId, customer } = input;
  const hasIdentity =
    Boolean(customer.external_customer_id) ||
    Boolean(customer.email) ||
    Boolean(customer.phone);
  if (!hasIdentity) return null;

  let existingId: string | null = null;

  if (customer.external_customer_id) {
    const byExternal = await admin
      .from("customers")
      .select("id")
      .eq("store_id", storeId)
      .eq("external_customer_id", customer.external_customer_id)
      .limit(1)
      .maybeSingle();
    if (byExternal.error) {
      throw new PermanentJobError("DATABASE_ERROR", "No se pudo buscar el cliente por id externo.");
    }
    existingId = byExternal.data?.id ?? null;
  }

  if (!existingId && customer.email) {
    const byEmail = await admin
      .from("customers")
      .select("id")
      .eq("store_id", storeId)
      .eq("email", customer.email)
      .limit(1)
      .maybeSingle();
    if (byEmail.error) {
      throw new PermanentJobError("DATABASE_ERROR", "No se pudo buscar el cliente por email.");
    }
    existingId = byEmail.data?.id ?? null;
  }

  if (!existingId && customer.phone) {
    const byPhone = await admin
      .from("customers")
      .select("id")
      .eq("store_id", storeId)
      .eq("phone", customer.phone)
      .limit(1)
      .maybeSingle();
    if (byPhone.error) {
      throw new PermanentJobError("DATABASE_ERROR", "No se pudo buscar el cliente por teléfono.");
    }
    existingId = byPhone.data?.id ?? null;
  }

  const now = new Date().toISOString();
  const patch = {
    ...(customer.external_customer_id
      ? { external_customer_id: customer.external_customer_id }
      : {}),
    ...(customer.email ? { email: customer.email } : {}),
    ...(customer.phone ? { phone: customer.phone } : {}),
    ...(customer.first_name ? { first_name: customer.first_name } : {}),
    ...(customer.last_name ? { last_name: customer.last_name } : {}),
    ...(customer.country_code ? { country_code: customer.country_code } : {}),
    ...(customer.city ? { city: customer.city } : {}),
    ...(customer.region ? { region: customer.region } : {}),
    ...(customer.postal_code ? { postal_code: customer.postal_code } : {}),
    updated_at: now,
  };

  if (existingId) {
    const update = await admin.from("customers").update(patch).eq("id", existingId).eq("store_id", storeId);
    if (update.error) {
      throw new PermanentJobError("DATABASE_ERROR", "No se pudo actualizar el cliente Shopify.");
    }
    return existingId;
  }

  const insert = await admin
    .from("customers")
    .insert({
      store_id: storeId,
      external_customer_id: customer.external_customer_id ?? null,
      email: customer.email ?? null,
      phone: customer.phone ?? null,
      first_name: customer.first_name ?? null,
      last_name: customer.last_name ?? null,
      country_code: customer.country_code ?? null,
      city: customer.city ?? null,
      region: customer.region ?? null,
      postal_code: customer.postal_code ?? null,
      metadata: { source: "shopify", synced_at: now } as Json,
      created_at: now,
      updated_at: now,
    })
    .select("id")
    .single();

  if (insert.error || !insert.data) {
    throw new PermanentJobError("DATABASE_ERROR", "No se pudo crear el cliente Shopify.");
  }
  return insert.data.id;
}
