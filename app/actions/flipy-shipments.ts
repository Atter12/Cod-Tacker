"use server";

import { revalidatePath } from "next/cache";
import { routes } from "@/config/routes";
import { actionFail, actionOk, type ActionResult } from "@/lib/actions/action-result";
import { IntegrationError, ValidationError } from "@/lib/errors";
import { createFlipyPartnerClient } from "@/lib/integrations/flipy/client";
import {
  readFlipyTiendaId,
  resolveFlipyPartnerKeyFromIntegration,
} from "@/lib/integrations/flipy/credentials";
import { getFlipyEnv } from "@/lib/integrations/flipy/env";
import {
  resolveFlipyIntegrationForStore,
  readFlipyOriginFromSettings,
} from "@/lib/integrations/flipy/webhook-ingress";
import {
  resolveShopifyFlipyPayment,
  type FlipyEscenarioPago,
} from "@/lib/integrations/flipy/resolve-payment";
import { getIntegrationRuntimeMode } from "@/lib/integrations/registry";
import { assertCanManageOrders } from "@/lib/orders/transitions";
import { can } from "@/lib/permissions/can";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireStoreAccess } from "@/lib/tenant/require-store-access";
import { requireUser } from "@/lib/auth/require-user";
import type { Json } from "@/types/database.generated";

export type CreateFlipyShipmentResult = {
  envioId: string;
  trackingUrl?: string | null;
  trackingToken?: string | null;
  estado: string;
};

function paymentKindFromOrder(order: {
  payment_status: string;
  metadata: Json;
}): "cod" | "prepaid" | null {
  const meta =
    order.metadata && typeof order.metadata === "object" && !Array.isArray(order.metadata)
      ? (order.metadata as Record<string, unknown>)
      : {};
  const kind = meta.shopify_payment_kind;
  if (kind === "cod" || kind === "prepaid") return kind;
  if (order.payment_status === "cash_expected") return "cod";
  if (order.payment_status === "unpaid") return "prepaid";
  return null;
}

export async function createFlipyShipmentFromOrder(input: {
  agencySlug: string;
  storeSlug: string;
  orderId: string;
  escenarioPago: FlipyEscenarioPago;
  destination: { address: string; lat: number; lng: number };
  fletePrice?: number | null;
}): Promise<ActionResult<CreateFlipyShipmentResult>> {
  try {
    if (getIntegrationRuntimeMode() !== "live") {
      throw new ValidationError("Crear envío Flipy requiere INTEGRATION_MODE=live.");
    }

    const user = await requireUser();
    const membership = await requireStoreAccess(input.agencySlug, input.storeSlug);
    assertCanManageOrders(can(membership.roles, "orders.manage"));
    if (!membership.storeId) throw new ValidationError("Tienda inválida.");

    const admin = createAdminClient();
    const orderRes = await admin
      .from("orders")
      .select(
        "id, store_id, agency_id, external_order_id, order_number, subtotal_amount, shipping_amount, total_amount, expected_cod_amount, payment_status, metadata, shipping_district, shipping_city, shipping_region, shipping_country_code, customer_id",
      )
      .eq("id", input.orderId)
      .eq("store_id", membership.storeId)
      .maybeSingle();
    if (!orderRes.data) throw new ValidationError("Pedido no encontrado.");

    const order = orderRes.data;
    const meta =
      order.metadata && typeof order.metadata === "object" && !Array.isArray(order.metadata)
        ? (order.metadata as Record<string, unknown>)
        : {};
    if (typeof meta.flipy_envio_id === "string" && meta.flipy_envio_id.trim()) {
      throw new ValidationError("Este pedido ya tiene un envío Flipy vinculado.");
    }

    const integration = await resolveFlipyIntegrationForStore(
      admin,
      membership.agencyId,
      membership.storeId,
    );
    if (!integration || integration.status === "disconnected") {
      throw new IntegrationError("Conecta Flipy en Integraciones antes de crear envíos.");
    }

    const flipyTiendaId = readFlipyTiendaId(integration.settings) ?? integration.external_account_id;
    if (!flipyTiendaId) {
      throw new IntegrationError("Integración Flipy sin tiendaId. Reconecta Flipy.");
    }

    const partnerKey = resolveFlipyPartnerKeyFromIntegration(integration);
    if (!partnerKey) {
      throw new IntegrationError("FLIPY_PARTNER_API_KEY no configurada.");
    }

    const origin = readFlipyOriginFromSettings(integration.settings);
    if (!origin.address || origin.lat == null || origin.lng == null) {
      throw new ValidationError("Integración Flipy sin dirección de origen. Reconecta con origen completo.");
    }

    const paymentResolution = resolveShopifyFlipyPayment({
      payment_kind: paymentKindFromOrder(order),
      subtotal_amount: order.subtotal_amount,
      shipping_amount: order.shipping_amount,
      total_amount: order.total_amount,
      expected_cod_amount: order.expected_cod_amount,
      tags: [],
    });
    if (paymentResolution.fulfillmentMode === "pickup") {
      throw new ValidationError("Pedido de recojo en tienda — no se crea envío Flipy.");
    }

    let customerName = "Cliente";
    let customerPhone: string | null = null;
    if (order.customer_id) {
      const customerRes = await admin
        .from("customers")
        .select("first_name, last_name, phone")
        .eq("id", order.customer_id)
        .maybeSingle();
      if (customerRes.data) {
        const name = [customerRes.data.first_name, customerRes.data.last_name]
          .filter(Boolean)
          .join(" ")
          .trim();
        if (name) customerName = name;
        customerPhone = customerRes.data.phone ?? null;
      }
    }

    const env = getFlipyEnv();
    const client = createFlipyPartnerClient({
      baseUrl: env.apiBaseUrl,
      partnerKey,
      partnerId: env.partnerId,
      externalStoreId: membership.storeId,
    });

    const externalOrderId = `shopify:${order.external_order_id}`;
    const codAmount =
      input.escenarioPago === "1A"
        ? null
        : paymentResolution.codAmount ??
          (order.subtotal_amount > 0 ? order.subtotal_amount : null);
    const flete =
      input.fletePrice ??
      paymentResolution.suggestedFlete ??
      (order.shipping_amount > 0 ? order.shipping_amount : null);

    const created = await client.createEnvio(
      {
        externalOrderId,
        orderNumber: order.order_number,
        escenarioPago: input.escenarioPago,
        codAmount,
        price: flete,
        originAddress: origin.address,
        originLat: origin.lat,
        originLng: origin.lng,
        originContact: integration.display_name ?? "Tienda",
        originPhone: undefined,
        destinationAddress: input.destination.address.trim(),
        destinationLat: input.destination.lat,
        destinationLng: input.destination.lng,
        destinationContact: customerName,
        destinationPhone: customerPhone,
        shopifyPayment: {
          productPaidAtCheckout: paymentResolution.productPaidAtCheckout,
          shippingPaidAtCheckout: paymentResolution.shippingPaidAtCheckout,
          shopifyShippingAmount: order.shipping_amount,
          shopifySubtotal: order.subtotal_amount,
          expectedCodProduct: order.expected_cod_amount,
          paymentKind: paymentKindFromOrder(order) ?? "cod",
          confirmedEscenario: input.escenarioPago,
        },
      },
      `codtracked:order:${order.id}`,
    );

    const now = new Date().toISOString();
    const nextMeta = {
      ...meta,
      fulfillment_mode: "delivery",
      flipy_envio_id: created.envioId,
      flipy_tracking_url: created.trackingUrl ?? null,
      shopify_flipy_payment: {
        suggestedEscenario: paymentResolution.suggestedEscenario,
        confirmedEscenario: input.escenarioPago,
        codAmount,
        fletePrice: flete,
        confirmedAt: now,
        confirmedBy: user.id,
      },
    };

    await admin
      .from("orders")
      .update({ metadata: nextMeta as Json, updated_at: now })
      .eq("id", order.id)
      .eq("store_id", membership.storeId);

    revalidatePath(routes.store.orderDetail(input.agencySlug, input.storeSlug, order.id));
    revalidatePath(routes.store.operations(input.agencySlug, input.storeSlug));

    return actionOk({
      envioId: created.envioId,
      trackingUrl: created.trackingUrl,
      trackingToken: created.trackingToken,
      estado: created.estado,
    });
  } catch (error) {
    return actionFail(error);
  }
}
