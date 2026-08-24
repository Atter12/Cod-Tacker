import "server-only";

import {
  resolveShopifyFlipyPayment,
  type FlipyEscenarioPago,
  type FlipyPaymentResolution,
} from "@/lib/integrations/flipy/resolve-payment";
import { readFlipyPickupKeywords } from "@/lib/integrations/flipy/settings";
import type { Json } from "@/types/database.generated";

export type FlipyOrderShipmentContext = {
  flipyEnvioId: string | null;
  flipyTrackingUrl: string | null;
  flipyTrackingToken: string | null;
  payment: FlipyPaymentResolution;
  suggestedEscenario: FlipyEscenarioPago | null;
  prefillAddress: string;
  isPickup: boolean;
  currencyCode: string;
  shippingAmount: number;
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

export function buildFlipyOrderShipmentContext(order: {
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
  currency_code: string;
}, integrationSettings?: unknown): FlipyOrderShipmentContext {
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

  const prefillAddress = [
    order.shipping_district,
    order.shipping_city,
    order.shipping_region,
    order.shipping_country_code,
    order.shipping_postal_code,
  ]
    .filter(Boolean)
    .join(", ");

  return {
    flipyEnvioId: typeof meta.flipy_envio_id === "string" ? meta.flipy_envio_id : null,
    flipyTrackingUrl: typeof meta.flipy_tracking_url === "string" ? meta.flipy_tracking_url : null,
    flipyTrackingToken: typeof meta.flipy_tracking_token === "string" ? meta.flipy_tracking_token : null,
    payment,
    suggestedEscenario: payment.suggestedEscenario,
    prefillAddress,
    isPickup: payment.fulfillmentMode === "pickup",
    currencyCode: order.currency_code,
    shippingAmount: Number(order.shipping_amount) || 0,
  };
}
