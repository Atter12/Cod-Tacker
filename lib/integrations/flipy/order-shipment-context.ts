import "server-only";

import { buildPrefillShippingAddress } from "@/lib/integrations/flipy/destination-consistency";
import { readOrderDestinationCoords } from "@/lib/integrations/flipy/auto-create";
import {
  resolveShopifyFlipyPayment,
  type FlipyEscenarioPago,
  type FlipyPaymentResolution,
} from "@/lib/integrations/flipy/resolve-payment";
import { mapShopifyPackageCare, type FlipyPackageCareId } from "@/lib/integrations/flipy/map-package-care";
import {
  mapShopifyPackageSize,
  type FlipyPackageSize,
} from "@/lib/integrations/flipy/map-package-size";
import { readFlipyPickupKeywords } from "@/lib/integrations/flipy/settings";
import type { Json } from "@/types/database.generated";

export { readOrderDestinationCoords } from "@/lib/integrations/flipy/auto-create";

export type FlipyOrderShipmentContext = {
  flipyEnvioId: string | null;
  flipyTrackingUrl: string | null;
  flipyTrackingToken: string | null;
  payment: FlipyPaymentResolution;
  suggestedEscenario: FlipyEscenarioPago | null;
  prefillAddress: string;
  shippingAddress1: string | null;
  shippingCoords: { lat: number; lng: number } | null;
  isPickup: boolean;
  currencyCode: string;
  shippingAmount: number;
  customerName: string | null;
  customerPhone: string | null;
  customerEmail: string | null;
  defaultPackageSize: FlipyPackageSize;
  defaultPackageCare: FlipyPackageCareId[];
};

function readMeta(metadata: Json): Record<string, unknown> {
  if (metadata && typeof metadata === "object" && !Array.isArray(metadata)) {
    return metadata as Record<string, unknown>;
  }
  return {};
}

function paymentKindFromMeta(meta: Record<string, unknown>, paymentStatus: string): "cod" | "prepaid" | null {
  const kind = meta.shopify_payment_kind;
  if (kind === "cod" || kind === "prepaid") return kind;
  if (paymentStatus === "cash_expected") return "cod";
  if (paymentStatus === "unpaid") return "prepaid";
  return null;
}

function readShippingLines(meta: Record<string, unknown>) {
  const raw = meta.shopify_shipping_lines;
  if (!Array.isArray(raw)) return null;
  return raw as Array<{ title?: string | null; code?: string | null } | null>;
}

function readNoteAttributes(meta: Record<string, unknown>) {
  const raw = meta.shopify_note_attributes;
  if (!Array.isArray(raw)) return null;
  return raw as Array<{ name?: string | null; value?: string | null } | null>;
}

function readShippingAddress1(meta: Record<string, unknown>): string | null {
  const raw = meta.shopify_shipping_address1 ?? meta.shipping_address1;
  return typeof raw === "string" && raw.trim() ? raw.trim() : null;
}

function readContactFromMeta(meta: Record<string, unknown>): {
  email: string | null;
  phone: string | null;
} {
  const email =
    typeof meta.customer_email === "string" && meta.customer_email.trim()
      ? meta.customer_email.trim()
      : null;
  const phone =
    typeof meta.customer_phone === "string" && meta.customer_phone.trim()
      ? meta.customer_phone.trim()
      : null;
  return { email, phone };
}

export function buildFlipyOrderShipmentContext(
  order: {
    payment_status: string;
    subtotal_amount: number;
    shipping_amount: number;
    total_amount: number;
    expected_cod_amount: number | null;
    metadata: Json;
    tags: string[] | null;
    shipping_district: string | null;
    shipping_city: string | null;
    shipping_region: string | null;
    shipping_country_code: string | null;
    shipping_postal_code: string | null;
    shipping_latitude?: number | null;
    shipping_longitude?: number | null;
    currency_code: string;
  },
  integrationSettings?: unknown,
  customer?: {
    first_name?: string | null;
    last_name?: string | null;
    phone?: string | null;
    email?: string | null;
  } | null,
  lineItems?: Array<{ title: string; quantity?: number | null }> | null,
): FlipyOrderShipmentContext {
  const meta = readMeta(order.metadata);
  const payment = resolveShopifyFlipyPayment({
    payment_kind: paymentKindFromMeta(meta, order.payment_status),
    subtotal_amount: order.subtotal_amount,
    shipping_amount: order.shipping_amount,
    total_amount: order.total_amount,
    expected_cod_amount: order.expected_cod_amount,
    shipping_lines: readShippingLines(meta),
    note_attributes: readNoteAttributes(meta),
    pickup_keywords: readFlipyPickupKeywords(integrationSettings),
    tags: order.tags,
  });

  const shippingAddress1 = readShippingAddress1(meta);
  const prefillAddress = buildPrefillShippingAddress({
    address1: shippingAddress1,
    district: order.shipping_district,
    city: order.shipping_city,
    region: order.shipping_region,
    countryCode: order.shipping_country_code,
    postalCode: order.shipping_postal_code,
  });

  const metaContact = readContactFromMeta(meta);
  const customerName = customer
    ? [customer.first_name, customer.last_name].filter(Boolean).join(" ").trim() || null
    : null;

  const lineTitles = (lineItems ?? []).map((line) => line.title);
  const defaultPackageSize = mapShopifyPackageSize(
    (lineItems ?? []).map((line) => ({
      title: line.title,
      quantity: line.quantity ?? 1,
    })),
  );
  const defaultPackageCare = mapShopifyPackageCare({
    tags: order.tags,
    lineTitles,
  });

  return {
    flipyEnvioId: typeof meta.flipy_envio_id === "string" ? meta.flipy_envio_id : null,
    flipyTrackingUrl: typeof meta.flipy_tracking_url === "string" ? meta.flipy_tracking_url : null,
    flipyTrackingToken: typeof meta.flipy_tracking_token === "string" ? meta.flipy_tracking_token : null,
    payment,
    suggestedEscenario: payment.suggestedEscenario,
    prefillAddress,
    shippingAddress1,
    shippingCoords: readOrderDestinationCoords({
      shipping_latitude: order.shipping_latitude ?? null,
      shipping_longitude: order.shipping_longitude ?? null,
    }),
    isPickup: payment.fulfillmentMode === "pickup",
    currencyCode: order.currency_code,
    shippingAmount: Number(order.shipping_amount) || 0,
    customerName,
    customerPhone: customer?.phone?.trim() || metaContact.phone,
    customerEmail: customer?.email?.trim() || metaContact.email,
    defaultPackageSize,
    defaultPackageCare,
  };
}
