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
import type { FlipyDevolucionInfo, FlipyTiendaResena } from "@/lib/integrations/flipy/partner-contract";
import { isFlipyDevolucionPendienteConfirmacion } from "@/lib/integrations/flipy/errors";
import type { Json } from "@/types/database.generated";

export { readOrderDestinationCoords } from "@/lib/integrations/flipy/auto-create";

export type FlipyOrderShipmentContext = {
  flipyEnvioId: string | null;
  flipyEstado: string | null;
  flipyDevolucion: FlipyDevolucionInfo | null;
  flipyDevolucionPendiente: boolean;
  flipyTiendaResena: FlipyTiendaResena | null;
  flipyCalificacionDisponible: boolean;
  flipyCalificacionPeso: number | null;
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

function readFlipyDevolucionFromMeta(meta: Record<string, unknown>): FlipyDevolucionInfo | null {
  const raw = meta.flipy_devolucion;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const bag = raw as Record<string, unknown>;
  return {
    estado: typeof bag.estado === "string" ? bag.estado : null,
    motivoId: typeof bag.motivoId === "string" ? bag.motivoId : null,
    motivoLabel: typeof bag.motivoLabel === "string" ? bag.motivoLabel : null,
    iniciadaAt: typeof bag.iniciadaAt === "string" ? bag.iniciadaAt : null,
    confirmadaAt: typeof bag.confirmadaAt === "string" ? bag.confirmadaAt : null,
    confirmadaPor: typeof bag.confirmadaPor === "string" ? bag.confirmadaPor : null,
    pendienteConfirmacion: Boolean(bag.pendienteConfirmacion),
    resenaHabilitada:
      typeof bag.resenaHabilitada === "boolean" ? bag.resenaHabilitada : null,
  };
}

function readFlipyTiendaResenaFromMeta(meta: Record<string, unknown>): FlipyTiendaResena | null {
  const raw = meta.flipy_tienda_resena;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const bag = raw as Record<string, unknown>;
  const id = typeof bag.id === "string" ? bag.id : null;
  const rating = typeof bag.rating === "number" ? bag.rating : null;
  if (!id || rating == null) return null;
  return {
    id,
    rating,
    peso: typeof bag.peso === "number" ? bag.peso : null,
    comentario: typeof bag.comentario === "string" ? bag.comentario : null,
    createdAt: typeof bag.createdAt === "string" ? bag.createdAt : null,
    autorTipo: typeof bag.autorTipo === "string" ? bag.autorTipo : null,
  };
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

  const flipyDevolucion = readFlipyDevolucionFromMeta(meta);
  const flipyTiendaResena = readFlipyTiendaResenaFromMeta(meta);

  return {
    flipyEnvioId: typeof meta.flipy_envio_id === "string" ? meta.flipy_envio_id : null,
    flipyEstado: typeof meta.flipy_estado === "string" ? meta.flipy_estado : null,
    flipyDevolucion,
    flipyDevolucionPendiente: isFlipyDevolucionPendienteConfirmacion(flipyDevolucion),
    flipyTiendaResena,
    flipyCalificacionDisponible:
      meta.flipy_calificacion_disponible === true && flipyTiendaResena == null,
    flipyCalificacionPeso:
      typeof meta.flipy_calificacion_peso === "number" ? meta.flipy_calificacion_peso : null,
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
