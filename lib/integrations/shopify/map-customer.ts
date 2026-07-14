function shopifyGidToExternalId(gidOrId: string): string {
  const trimmed = gidOrId.trim();
  const match = /\/(\d+)\s*$/.exec(trimmed);
  if (match?.[1]) return match[1];
  if (/^\d+$/.test(trimmed)) return trimmed;
  return trimmed;
}

/** Normalized customer fragment shared by webhook + GraphQL sync jobs. */
export type ShopifyMappedCustomer = {
  external_customer_id?: string;
  email?: string;
  phone?: string;
  first_name?: string;
  last_name?: string;
  country_code?: string;
  city?: string;
  region?: string;
  postal_code?: string;
};

/** Shipping fields written onto `orders.shipping_*`. */
export type ShopifyMappedShipping = {
  country_code?: string;
  region?: string;
  city?: string;
  district?: string;
  postal_code?: string;
};

export type ShopifyRestCustomer = {
  id?: number | string | null;
  admin_graphql_api_id?: string | null;
  email?: string | null;
  phone?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  default_address?: {
    city?: string | null;
    province?: string | null;
    zip?: string | null;
    country_code?: string | null;
  } | null;
};

export type ShopifyRestShippingAddress = {
  first_name?: string | null;
  last_name?: string | null;
  phone?: string | null;
  city?: string | null;
  province?: string | null;
  zip?: string | null;
  country_code?: string | null;
  /** Sometimes present on COD checkouts. */
  address2?: string | null;
};

export type ShopifyGraphqlCustomer = {
  id?: string | null;
  email?: string | null;
  phone?: string | null;
  firstName?: string | null;
  lastName?: string | null;
};

export type ShopifyGraphqlMailingAddress = {
  firstName?: string | null;
  lastName?: string | null;
  phone?: string | null;
  city?: string | null;
  province?: string | null;
  zip?: string | null;
  countryCodeV2?: string | null;
};

function cleanText(value: string | null | undefined, max = 200): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  return trimmed.slice(0, max);
}

function cleanEmail(value: string | null | undefined): string | undefined {
  const email = cleanText(value, 320)?.toLowerCase();
  if (!email || !email.includes("@")) return undefined;
  return email;
}

function cleanPhone(value: string | null | undefined): string | undefined {
  const phone = cleanText(value, 40);
  if (!phone) return undefined;
  // Keep digits / leading + for WhatsApp matching; drop empty after strip.
  const compact = phone.replace(/[^\d+]/g, "");
  if (compact.replace(/\D/g, "").length < 6) return undefined;
  return phone;
}

function cleanCountry(value: string | null | undefined): string | undefined {
  const code = cleanText(value, 2)?.toUpperCase();
  return code && code.length === 2 ? code : undefined;
}

function externalCustomerIdFromRest(customer: ShopifyRestCustomer | null | undefined): string | undefined {
  if (!customer) return undefined;
  if (customer.id != null) return String(customer.id);
  if (customer.admin_graphql_api_id) return shopifyGidToExternalId(customer.admin_graphql_api_id);
  return undefined;
}

/**
 * Merge Shopify customer + order email/phone + shipping into one upsert payload.
 * Guest checkouts often only have shipping_address / order.phone.
 */
export function mapRestCustomerFields(input: {
  customer?: ShopifyRestCustomer | null;
  shipping_address?: ShopifyRestShippingAddress | null;
  email?: string | null;
  phone?: string | null;
}): { customer: ShopifyMappedCustomer | undefined; shipping: ShopifyMappedShipping | undefined } {
  const c = input.customer;
  const ship = input.shipping_address;
  const addr = c?.default_address;

  const first_name =
    cleanText(c?.first_name) ?? cleanText(ship?.first_name);
  const last_name = cleanText(c?.last_name) ?? cleanText(ship?.last_name);
  const email = cleanEmail(c?.email) ?? cleanEmail(input.email);
  const phone =
    cleanPhone(c?.phone) ?? cleanPhone(input.phone) ?? cleanPhone(ship?.phone);

  const city = cleanText(addr?.city) ?? cleanText(ship?.city);
  const region = cleanText(addr?.province) ?? cleanText(ship?.province);
  const postal_code = cleanText(addr?.zip) ?? cleanText(ship?.zip);
  const country_code = cleanCountry(addr?.country_code) ?? cleanCountry(ship?.country_code);

  const external_customer_id = externalCustomerIdFromRest(c);

  const customer: ShopifyMappedCustomer | undefined =
    external_customer_id || email || phone || first_name || last_name
      ? {
          ...(external_customer_id ? { external_customer_id } : {}),
          ...(email ? { email } : {}),
          ...(phone ? { phone } : {}),
          ...(first_name ? { first_name } : {}),
          ...(last_name ? { last_name } : {}),
          ...(country_code ? { country_code } : {}),
          ...(city ? { city } : {}),
          ...(region ? { region } : {}),
          ...(postal_code ? { postal_code } : {}),
        }
      : undefined;

  const shipping: ShopifyMappedShipping | undefined =
    country_code || region || city || postal_code || cleanText(ship?.address2)
      ? {
          ...(country_code ? { country_code } : {}),
          ...(region ? { region } : {}),
          ...(city ? { city } : {}),
          ...(cleanText(ship?.address2) ? { district: cleanText(ship?.address2) } : {}),
          ...(postal_code ? { postal_code } : {}),
        }
      : undefined;

  return { customer, shipping };
}

export function mapGraphqlCustomerFields(input: {
  customer?: ShopifyGraphqlCustomer | null;
  shippingAddress?: ShopifyGraphqlMailingAddress | null;
  email?: string | null;
  phone?: string | null;
}): { customer: ShopifyMappedCustomer | undefined; shipping: ShopifyMappedShipping | undefined } {
  const c = input.customer;
  const ship = input.shippingAddress;

  const first_name = cleanText(c?.firstName) ?? cleanText(ship?.firstName);
  const last_name = cleanText(c?.lastName) ?? cleanText(ship?.lastName);
  const email = cleanEmail(c?.email) ?? cleanEmail(input.email);
  const phone =
    cleanPhone(c?.phone) ?? cleanPhone(input.phone) ?? cleanPhone(ship?.phone);

  const city = cleanText(ship?.city);
  const region = cleanText(ship?.province);
  const postal_code = cleanText(ship?.zip);
  const country_code = cleanCountry(ship?.countryCodeV2);

  const external_customer_id = c?.id ? shopifyGidToExternalId(c.id) : undefined;

  const customer: ShopifyMappedCustomer | undefined =
    external_customer_id || email || phone || first_name || last_name
      ? {
          ...(external_customer_id ? { external_customer_id } : {}),
          ...(email ? { email } : {}),
          ...(phone ? { phone } : {}),
          ...(first_name ? { first_name } : {}),
          ...(last_name ? { last_name } : {}),
          ...(country_code ? { country_code } : {}),
          ...(city ? { city } : {}),
          ...(region ? { region } : {}),
          ...(postal_code ? { postal_code } : {}),
        }
      : undefined;

  const shipping: ShopifyMappedShipping | undefined =
    country_code || region || city || postal_code
      ? {
          ...(country_code ? { country_code } : {}),
          ...(region ? { region } : {}),
          ...(city ? { city } : {}),
          ...(postal_code ? { postal_code } : {}),
        }
      : undefined;

  return { customer, shipping };
}
