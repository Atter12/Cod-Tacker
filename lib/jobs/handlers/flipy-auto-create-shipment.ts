import { PermanentJobError } from "@/lib/jobs/errors";
import {
  buildOrderShippingAddress,
  evaluateFlipyAutoCreate,
  readOrderDestinationCoords,
} from "@/lib/integrations/flipy/auto-create";
import { createFlipyShipmentForOrder } from "@/lib/integrations/flipy/create-shipment-service";
import { createFlipyPartnerClient } from "@/lib/integrations/flipy/client";
import { resolveFlipyPartnerKeyFromIntegration } from "@/lib/integrations/flipy/credentials";
import { getFlipyEnv } from "@/lib/integrations/flipy/env";
import { flipyErrorUserHint, readFlipyErrorCode } from "@/lib/integrations/flipy/errors";
import { buildFlipyOrderShipmentContext } from "@/lib/integrations/flipy/order-shipment-context";
import {
  readFlipyAutoCreateEnabled,
  readFlipyAutoCreateMinConfidence,
} from "@/lib/integrations/flipy/settings";
import { resolveFlipyIntegrationForStore } from "@/lib/integrations/flipy/webhook-ingress";
import { getIntegrationRuntimeMode } from "@/lib/integrations/registry";
import type { JobHandler } from "@/lib/jobs/types";
import type { Json } from "@/types/database.generated";
import { z } from "zod";

const payloadSchema = z.object({
  order_id: z.string().uuid(),
});

async function patchAutoCreateMeta(
  admin: Parameters<JobHandler>[0]["admin"],
  orderId: string,
  storeId: string,
  patch: Record<string, unknown>,
) {
  const orderRes = await admin.from("orders").select("metadata").eq("id", orderId).eq("store_id", storeId).maybeSingle();
  if (!orderRes.data) return;
  const meta =
    orderRes.data.metadata && typeof orderRes.data.metadata === "object" && !Array.isArray(orderRes.data.metadata)
      ? (orderRes.data.metadata as Record<string, unknown>)
      : {};
  const now = new Date().toISOString();
  await admin
    .from("orders")
    .update({
      metadata: {
        ...meta,
        flipy_auto_create: {
          ...(typeof meta.flipy_auto_create === "object" && meta.flipy_auto_create && !Array.isArray(meta.flipy_auto_create)
            ? (meta.flipy_auto_create as Record<string, unknown>)
            : {}),
          ...patch,
          at: now,
        },
      } as Json,
      updated_at: now,
    })
    .eq("id", orderId)
    .eq("store_id", storeId);
}

async function createAutoCreateAlert(input: {
  admin: Parameters<JobHandler>[0]["admin"];
  agencyId: string;
  storeId: string;
  orderId: string;
  title: string;
  body: string;
  severity: "info" | "warning" | "critical";
}) {
  await input.admin.from("alerts").insert({
    agency_id: input.agencyId,
    store_id: input.storeId,
    order_id: input.orderId,
    title: input.title,
    body: input.body,
    severity: input.severity,
    type: "flipy_auto_create",
    status: "open",
    source_type: "flipy_auto_create",
    data: {} as Json,
  });
}

export const handleFlipyAutoCreateShipment: JobHandler = async ({ admin, job, payload }) => {
  if (!job.store_id) {
    throw new PermanentJobError("MISSING_STORE", "El trabajo Flipy auto-create requiere store_id.");
  }

  if (getIntegrationRuntimeMode() !== "live") {
    return {
      ok: true,
      action: "skipped",
      entityType: "order",
      entityId: job.store_id,
      detail: "integration_mode_not_live",
    };
  }

  const parsed = payloadSchema.safeParse(payload);
  if (!parsed.success) {
    throw new PermanentJobError("INVALID_PAYLOAD", "Payload de auto-create Flipy inválido.");
  }

  const orderRes = await admin
    .from("orders")
    .select(
      "id, store_id, payment_status, subtotal_amount, shipping_amount, total_amount, expected_cod_amount, metadata, tags, shipping_district, shipping_city, shipping_region, shipping_country_code, shipping_postal_code, shipping_latitude, shipping_longitude, currency_code",
    )
    .eq("id", parsed.data.order_id)
    .eq("store_id", job.store_id)
    .maybeSingle();

  if (!orderRes.data) {
    return {
      ok: true,
      action: "skipped",
      entityType: "order",
      entityId: parsed.data.order_id,
      detail: "order_not_found",
    };
  }

  const order = orderRes.data;
  const meta =
    order.metadata && typeof order.metadata === "object" && !Array.isArray(order.metadata)
      ? (order.metadata as Record<string, unknown>)
      : {};
  const flipyEnvioId = typeof meta.flipy_envio_id === "string" ? meta.flipy_envio_id : null;

  const integration = await resolveFlipyIntegrationForStore(admin, job.agency_id, job.store_id);
  if (!integration || integration.status === "disconnected") {
    return {
      ok: true,
      action: "skipped",
      entityType: "order",
      entityId: order.id,
      detail: "flipy_not_connected",
    };
  }

  const ctx = buildFlipyOrderShipmentContext(order, integration.settings);
  const destinationAddress = buildOrderShippingAddress({
    ...order,
    shippingAddress1: ctx.shippingAddress1,
  });
  let destinationCoords = readOrderDestinationCoords(order);

  const evaluation = evaluateFlipyAutoCreate({
    enabled: readFlipyAutoCreateEnabled(integration.settings),
    minConfidence: readFlipyAutoCreateMinConfidence(integration.settings),
    flipyEnvioId,
    payment: ctx.payment,
    destinationCoords,
    destinationAddress,
  });

  if (!evaluation.eligible || !evaluation.escenarioPago) {
    await patchAutoCreateMeta(admin, order.id, job.store_id, {
      source: "auto_create",
      status: "skipped",
      reason: evaluation.skipReason,
      reasons: evaluation.reasons,
    });
    return {
      ok: true,
      action: "skipped",
      entityType: "order",
      entityId: order.id,
      detail: evaluation.skipReason ?? "not_eligible",
    };
  }

  if (!destinationCoords) {
    const partnerKey = resolveFlipyPartnerKeyFromIntegration(integration);
    if (!partnerKey) {
      throw new PermanentJobError("MISSING_CONFIG", "FLIPY_PARTNER_API_KEY no configurada.");
    }
    const env = getFlipyEnv();
    const client = createFlipyPartnerClient({
      baseUrl: env.apiBaseUrl,
      partnerKey,
      partnerId: env.partnerId,
      externalStoreId: job.store_id,
    });
    const geocoded = await client.geocodeAddress(destinationAddress);
    if (!geocoded) {
      await patchAutoCreateMeta(admin, order.id, job.store_id, {
        source: "auto_create",
        status: "skipped",
        reason: "geocode_failed",
      });
      await createAutoCreateAlert({
        admin,
        agencyId: job.agency_id,
        storeId: job.store_id,
        orderId: order.id,
        title: "Flipy: auto-create requiere mapa",
        body: "No se pudo geocodificar la dirección Shopify. Confirma el pin en el mapa embed.",
        severity: "warning",
      });
      return {
        ok: true,
        action: "skipped",
        entityType: "order",
        entityId: order.id,
        detail: "geocode_failed",
      };
    }
    destinationCoords = { lat: geocoded.lat, lng: geocoded.lng };
  }

  try {
    const created = await createFlipyShipmentForOrder({
      admin,
      agencyId: job.agency_id,
      storeId: job.store_id,
      orderId: order.id,
      escenarioPago: evaluation.escenarioPago,
      destination: {
        address: destinationAddress || `${destinationCoords.lat},${destinationCoords.lng}`,
        lat: destinationCoords.lat,
        lng: destinationCoords.lng,
      },
      source: "auto_create",
    });

    return {
      ok: true,
      action: "created",
      entityType: "order",
      entityId: order.id,
      detail: `envio=${created.envioId}`,
    };
  } catch (error) {
    const code = readFlipyErrorCode(error);
    const hint = flipyErrorUserHint(code);
    await patchAutoCreateMeta(admin, order.id, job.store_id, {
      source: "auto_create",
      status: "failed",
      errorCode: code,
      errorMessage: hint ?? (error instanceof Error ? error.message : "unknown"),
    });
    await createAutoCreateAlert({
      admin,
      agencyId: job.agency_id,
      storeId: job.store_id,
      orderId: order.id,
      title: "Flipy: falló auto-create",
      body: hint ?? "Revisa saldo, escenario o reconecta Flipy e intenta manualmente.",
      severity: code === "SALDO_INSUFICIENTE_HOLD" ? "warning" : "critical",
    });
    throw error;
  }
};
