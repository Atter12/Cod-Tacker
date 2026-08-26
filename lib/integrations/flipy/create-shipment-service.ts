import "server-only";

import { IntegrationError, ValidationError } from "@/lib/errors";
import { createFlipyPartnerClient } from "@/lib/integrations/flipy/client";
import {
  readFlipyTiendaId,
  resolveFlipyPartnerKeyFromIntegration,
} from "@/lib/integrations/flipy/credentials";
import { getFlipyEnv } from "@/lib/integrations/flipy/env";
import { deriveCodAmountFromD3 } from "@/lib/integrations/flipy/labels";
import { validateFlipyFletePrice } from "@/lib/integrations/flipy/flete-rules";
import {
  mapShopifyPackageCare,
  type FlipyPackageCareId,
} from "@/lib/integrations/flipy/map-package-care";
import {
  mapShopifyPackageSize,
  type FlipyPackageSize,
} from "@/lib/integrations/flipy/map-package-size";
import type { FlipyFleteQuote } from "@/lib/integrations/flipy/partner-contract";
import {
  resolveShopifyFlipyPayment,
  type FlipyEscenarioPago,
} from "@/lib/integrations/flipy/resolve-payment";
import { readFlipyPickupKeywords, readFlipyV02Enabled } from "@/lib/integrations/flipy/settings";
import { buildFlipyV02CreateExtensions } from "@/lib/integrations/flipy/v02-create-extensions";
import {
  readFlipyOriginFromSettings,
  resolveFlipyIntegrationForStore,
} from "@/lib/integrations/flipy/webhook-ingress";
import { getIntegrationRuntimeMode } from "@/lib/integrations/registry";
import type { JobsAdminClient } from "@/lib/jobs/types";
import type { Json } from "@/types/database.generated";

export type FlipyShipmentCreateResult = {
  envioId: string;
  trackingUrl?: string | null;
  trackingToken?: string | null;
  estado: string;
  fulfillmentMode?: "smart" | "bid" | null;
  assignedMotorizado?: {
    id: string;
    displayName?: string | null;
    etaMinutes?: number | null;
  } | null;
  appWebUrl?: string | null;
  appDeepLink?: string | null;
  pujasWebUrl?: string | null;
  fleteQuote?: FlipyFleteQuote | null;
};

type OrderRow = {
  id: string;
  store_id: string;
  agency_id: string;
  external_order_id: string;
  order_number: string;
  subtotal_amount: number;
  shipping_amount: number;
  total_amount: number;
  expected_cod_amount: number | null;
  payment_status: string;
  metadata: Json;
  tags: string[] | null;
  shipping_district: string | null;
  shipping_city: string | null;
  shipping_region: string | null;
  shipping_country_code: string | null;
  customer_id: string | null;
};

type OrderItemRow = {
  title: string;
  quantity: number;
};

function readMeta(metadata: Json): Record<string, unknown> {
  if (metadata && typeof metadata === "object" && !Array.isArray(metadata)) {
    return metadata as Record<string, unknown>;
  }
  return {};
}

function readNoteAttributes(meta: Record<string, unknown>) {
  const raw = meta.shopify_note_attributes;
  if (!Array.isArray(raw)) return null;
  return raw as Array<{ name?: string | null; value?: string | null } | null>;
}

function readShippingLines(meta: Record<string, unknown>) {
  const raw = meta.shopify_shipping_lines;
  if (!Array.isArray(raw)) return null;
  return raw as Array<{ title?: string | null; code?: string | null } | null>;
}

function paymentKindFromOrder(order: { payment_status: string; metadata: Json }): "cod" | "prepaid" | null {
  const meta = readMeta(order.metadata);
  const kind = meta.shopify_payment_kind;
  if (kind === "cod" || kind === "prepaid") return kind;
  if (order.payment_status === "cash_expected") return "cod";
  if (order.payment_status === "unpaid") return "prepaid";
  return null;
}

export async function createFlipyShipmentForOrder(input: {
  admin: JobsAdminClient;
  agencyId: string;
  storeId: string;
  orderId: string;
  escenarioPago: FlipyEscenarioPago;
  destination: { address: string; lat: number; lng: number };
  fletePrice?: number | null;
  fleteQuote?: FlipyFleteQuote | null;
  packageSize?: FlipyPackageSize | null;
  packageCare?: FlipyPackageCareId[] | null;
  packageCareNote?: string | null;
  destinationEmail?: string | null;
  origin?: {
    address?: string | null;
    lat?: number | null;
    lng?: number | null;
    contactName?: string | null;
    phone?: string | null;
  } | null;
  destinationContact?: {
    name?: string | null;
    phone?: string | null;
  } | null;
  notes?: string | null;
  confirmedByUserId?: string | null;
  source?: "manual" | "auto_create";
}): Promise<FlipyShipmentCreateResult> {
  if (getIntegrationRuntimeMode() !== "live") {
    throw new ValidationError("Crear envío Flipy requiere INTEGRATION_MODE=live.");
  }

  const orderRes = await input.admin
    .from("orders")
    .select(
      "id, store_id, agency_id, external_order_id, order_number, subtotal_amount, shipping_amount, total_amount, expected_cod_amount, payment_status, metadata, tags, shipping_district, shipping_city, shipping_region, shipping_country_code, customer_id",
    )
    .eq("id", input.orderId)
    .eq("store_id", input.storeId)
    .maybeSingle();
  if (!orderRes.data) throw new ValidationError("Pedido no encontrado.");

  const order = orderRes.data as OrderRow;
  const meta = readMeta(order.metadata);
  if (typeof meta.flipy_envio_id === "string" && meta.flipy_envio_id.trim()) {
    throw new ValidationError("Este pedido ya tiene un envío Flipy vinculado.");
  }

  const integration = await resolveFlipyIntegrationForStore(input.admin, input.agencyId, input.storeId);
  if (!integration || integration.status === "disconnected") {
    throw new IntegrationError("Conecta Flipy en Integraciones antes de crear envíos.");
  }

  const v02Enabled = readFlipyV02Enabled(integration.settings);

  const flipyTiendaId = readFlipyTiendaId(integration.settings) ?? integration.external_account_id;
  if (!flipyTiendaId) {
    throw new IntegrationError("Integración Flipy sin tiendaId. Reconecta Flipy.");
  }

  const partnerKey = resolveFlipyPartnerKeyFromIntegration(integration);
  if (!partnerKey) {
    throw new IntegrationError("FLIPY_PARTNER_API_KEY no configurada.");
  }

  const originDefaults = readFlipyOriginFromSettings(integration.settings);
  const originAddress = input.origin?.address?.trim() || originDefaults.address;
  const originLat = input.origin?.lat ?? originDefaults.lat;
  const originLng = input.origin?.lng ?? originDefaults.lng;
  if (!originAddress || originLat == null || originLng == null) {
    throw new ValidationError("Integración Flipy sin dirección de origen. Reconecta con origen completo.");
  }

  const paymentResolution = resolveShopifyFlipyPayment({
    payment_kind: paymentKindFromOrder(order),
    subtotal_amount: order.subtotal_amount,
    shipping_amount: order.shipping_amount,
    total_amount: order.total_amount,
    expected_cod_amount: order.expected_cod_amount,
    shipping_lines: readShippingLines(meta),
    note_attributes: readNoteAttributes(meta),
    pickup_keywords: readFlipyPickupKeywords(integration.settings),
    tags: order.tags,
  });
  if (paymentResolution.fulfillmentMode === "pickup") {
    throw new ValidationError("Pedido de recojo en tienda — no se crea envío Flipy.");
  }

  const destinationAddress = input.destination.address.trim();
  if (!destinationAddress) {
    throw new ValidationError("Confirma o edita la dirección de entrega antes de crear el envío.");
  }

  let customerName = "Cliente";
  let customerPhone: string | null = null;
  let customerEmail: string | null = null;
  if (order.customer_id) {
    const customerRes = await input.admin
      .from("customers")
      .select("first_name, last_name, phone, email")
      .eq("id", order.customer_id)
      .maybeSingle();
    if (customerRes.data) {
      const name = [customerRes.data.first_name, customerRes.data.last_name]
        .filter(Boolean)
        .join(" ")
        .trim();
      if (name) customerName = name;
      customerPhone = customerRes.data.phone ?? null;
      customerEmail = customerRes.data.email ?? null;
    }
  }

  const itemsRes = await input.admin
    .from("order_items")
    .select("title, quantity")
    .eq("order_id", order.id)
    .eq("store_id", input.storeId);
  const lineItems = (itemsRes.data ?? []) as OrderItemRow[];

  const destinationContactName = input.destinationContact?.name?.trim() || customerName;
  const destinationContactPhone =
    input.destinationContact?.phone?.trim() || customerPhone || undefined;
  const destinationEmail =
    input.destinationEmail?.trim() || customerEmail?.trim() || undefined;
  const originContact =
    input.origin?.contactName?.trim() ||
    originDefaults.contactName ||
    integration.display_name ||
    "Tienda";
  const originPhone =
    input.origin?.phone?.trim() || originDefaults.phone || undefined;

  const packageSize =
    input.packageSize ??
    mapShopifyPackageSize(
      lineItems.map((line) => ({
        title: line.title,
        quantity: line.quantity,
      })),
    );
  const packageCare =
    input.packageCare ??
    mapShopifyPackageCare({
      tags: order.tags,
      lineTitles: lineItems.map((line) => line.title),
    });
  const packageCareNote = input.packageCareNote?.trim() || undefined;

  const env = getFlipyEnv();
  const client = createFlipyPartnerClient({
    baseUrl: env.apiBaseUrl,
    partnerKey,
    partnerId: env.partnerId,
    externalStoreId: input.storeId,
  });

  const externalOrderId = `shopify:${order.external_order_id}`;
  const smartEligible = paymentResolution.smartEligible;
  const operationalMode = paymentResolution.flipyFulfillmentMode ?? (smartEligible ? "smart" : "bid");
  const fleteQuote = input.fleteQuote ?? null;

  const codAmount = deriveCodAmountFromD3(
    input.escenarioPago,
    paymentResolution,
    order.subtotal_amount,
  );

  const fleteValidation = validateFlipyFletePrice(
    input.escenarioPago,
    input.fletePrice !== undefined
      ? input.fletePrice
      : paymentResolution.suggestedFlete ??
          (order.shipping_amount > 0 ? order.shipping_amount : null),
    { smartEligible, fleteQuote },
  );
  if (!fleteValidation.ok || fleteValidation.value == null) {
    throw new ValidationError(fleteValidation.error ?? "Oferta de flete inválida.");
  }
  const flete = fleteValidation.value;

  if (v02Enabled && smartEligible && !fleteQuote) {
    throw new ValidationError("Cotización de flete requerida para asignación automática (smart).");
  }

  const noteAttributes = readNoteAttributes(meta);
  const notes = input.notes?.trim();
  const paymentKind = paymentKindFromOrder(order) ?? "cod";

  const createInput = {
    externalOrderId,
    orderNumber: order.order_number,
    title: order.order_number ? `#${order.order_number.replace(/^#/, "")}` : undefined,
    escenarioPago: input.escenarioPago,
    codAmount,
    price: flete,
    originAddress,
    originLat,
    originLng,
    originContact,
    originPhone,
    destinationAddress,
    destinationLat: input.destination.lat,
    destinationLng: input.destination.lng,
    destinationContact: destinationContactName,
    destinationPhone: destinationContactPhone,
    destinationEmail,
    noteAttributes: notes
      ? [...(noteAttributes ?? []), { name: "flipy_notas_motorizado", value: notes }]
      : noteAttributes,
    shopifyPayment: {
      productPaidAtCheckout: paymentResolution.productPaidAtCheckout,
      shippingPaidAtCheckout: paymentResolution.shippingPaidAtCheckout,
      shopifyShippingAmount: order.shipping_amount ?? 0,
      shopifySubtotal: order.subtotal_amount ?? 0,
      expectedCodProduct: paymentResolution.expectedCodProduct,
      expectedCodShipping: paymentResolution.expectedCodShipping,
      paymentKind,
      confirmedEscenario: input.escenarioPago,
      ...(noteAttributes?.length ? { noteAttributes } : {}),
    },
    ...buildFlipyV02CreateExtensions({
      v02Enabled,
      smartEligible,
      operationalMode,
      packageSize,
      packageCare,
      packageCareNote,
      fleteQuote,
    }),
  };

  const created = await client.createEnvio(createInput, `codtracked:order:${order.id}`);

  const now = new Date().toISOString();
  const nextMeta = {
    ...meta,
    fulfillment_mode: "delivery",
    flipy_envio_id: created.envioId,
    flipy_tracking_url: created.trackingUrl ?? null,
    flipy_tracking_token: created.trackingToken ?? null,
    flipy_auto_create: {
      source: input.source ?? "manual",
      status: "created",
      at: now,
    },
    shopify_flipy_payment: {
      suggestedEscenario: paymentResolution.suggestedEscenario,
      confirmedEscenario: input.escenarioPago,
      codAmount,
      fletePrice: flete,
      smartEligible: paymentResolution.smartEligible,
      fulfillmentMode: created.fulfillmentMode ?? operationalMode,
      fleteQuote: created.fleteQuote ?? fleteQuote ?? null,
      packageSize: v02Enabled ? packageSize : undefined,
      confirmedAt: now,
      confirmedBy: input.confirmedByUserId ?? null,
    },
  };

  await input.admin
    .from("orders")
    .update({ metadata: nextMeta as Json, updated_at: now })
    .eq("id", order.id)
    .eq("store_id", input.storeId);

  return {
    envioId: created.envioId,
    trackingUrl: created.trackingUrl,
    trackingToken: created.trackingToken,
    estado: created.estado,
    fulfillmentMode: created.fulfillmentMode ?? operationalMode,
    assignedMotorizado: created.assignedMotorizado ?? null,
    appWebUrl: created.appWebUrl,
    appDeepLink: created.appDeepLink,
    pujasWebUrl: created.pujasWebUrl,
    fleteQuote: created.fleteQuote ?? fleteQuote,
  };
}
