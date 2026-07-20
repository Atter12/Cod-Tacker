import type { DatabaseClient } from "@/services/_shared";
import type { Json } from "@/types/database.generated";

export type OrderPurchaseContact = {
  email: string | null;
  phone: string | null;
  countryCode: string | null;
  city: string | null;
};

export type PurchaseContactFlags = {
  email_present: boolean;
  phone_present: boolean;
  country_present: boolean;
  city_present: boolean;
  external_id_hashed: true;
};

function trimOrNull(value: string | null | undefined): string | null {
  const t = value?.trim();
  return t ? t : null;
}

function readMetadataContact(metadata: Json | null | undefined): {
  email: string | null;
  phone: string | null;
} {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    return { email: null, phone: null };
  }
  const bag = metadata as Record<string, unknown>;
  const emailRaw = bag.customer_email ?? bag.email;
  const phoneRaw = bag.customer_phone ?? bag.phone;
  return {
    email: typeof emailRaw === "string" ? trimOrNull(emailRaw) : null,
    phone: typeof phoneRaw === "string" ? trimOrNull(phoneRaw) : null,
  };
}

/** Snapshot flags for conversion_events.user_data (never store raw PII). */
export function purchaseContactFlags(contact: OrderPurchaseContact): PurchaseContactFlags {
  return {
    email_present: Boolean(contact.email?.trim()),
    phone_present: Boolean(contact.phone?.trim()),
    country_present: Boolean(contact.countryCode?.trim()),
    city_present: Boolean(contact.city?.trim()),
    external_id_hashed: true,
  };
}

/**
 * Prefer explicit overrides, fill gaps from resolved order/customer contact.
 * Avoids the bug where passing only city/country skipped DB email/phone.
 */
export function mergePurchaseContact(
  resolved: OrderPurchaseContact,
  override: Partial<OrderPurchaseContact> = {},
): OrderPurchaseContact {
  return {
    email: trimOrNull(override.email) ?? resolved.email,
    phone: trimOrNull(override.phone) ?? resolved.phone,
    countryCode: trimOrNull(override.countryCode) ?? resolved.countryCode,
    city: trimOrNull(override.city) ?? resolved.city,
  };
}

/**
 * Resolve match keys for Meta/TikTok Purchase:
 * customers row → order.metadata backup → shipping geo on the order.
 */
export async function resolveOrderCustomerContact(
  admin: DatabaseClient,
  storeId: string,
  orderId: string,
): Promise<OrderPurchaseContact> {
  const order = await admin
    .from("orders")
    .select("customer_id, shipping_country_code, shipping_city, metadata")
    .eq("id", orderId)
    .eq("store_id", storeId)
    .maybeSingle();

  const metaContact = readMetadataContact(order.data?.metadata ?? null);

  let email: string | null = null;
  let phone: string | null = null;
  let customerCountry: string | null = null;
  let customerCity: string | null = null;

  if (order.data?.customer_id) {
    const customer = await admin
      .from("customers")
      .select("email, phone, country_code, city")
      .eq("id", order.data.customer_id)
      .eq("store_id", storeId)
      .maybeSingle();
    email = trimOrNull(customer.data?.email);
    phone = trimOrNull(customer.data?.phone);
    customerCountry = trimOrNull(customer.data?.country_code);
    customerCity = trimOrNull(customer.data?.city);
  }

  return {
    email: email ?? metaContact.email,
    phone: phone ?? metaContact.phone,
    countryCode:
      trimOrNull(order.data?.shipping_country_code) ?? customerCountry,
    city: trimOrNull(order.data?.shipping_city) ?? customerCity,
  };
}

/** Denormalize Shopify contact onto order.metadata for Purchase matching fallback. */
export function orderContactMetadataPatch(customer?: {
  email?: string | null;
  phone?: string | null;
} | null): Record<string, string> {
  const patch: Record<string, string> = {};
  const email = trimOrNull(customer?.email ?? null);
  const phone = trimOrNull(customer?.phone ?? null);
  if (email) patch.customer_email = email.toLowerCase();
  if (phone) patch.customer_phone = phone;
  return patch;
}
