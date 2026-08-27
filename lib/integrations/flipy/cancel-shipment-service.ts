import "server-only";

import { ValidationError } from "@/lib/errors";
import type {
  FlipyCancelEnvioInput,
  FlipyCancelEnvioSuccessResult,
} from "@/lib/integrations/flipy/partner-contract";
import { FlipyPartnerApiError } from "@/lib/integrations/flipy/errors";
import { getFlipyClientForStore } from "@/lib/integrations/flipy/cotizar-flete-service";
import type { JobsAdminClient } from "@/lib/jobs/types";

import type { Json } from "@/types/database.generated";

export type FlipyCancelShipmentBlockedResult = {
  blocked: true;
  code: string;
  message: string;
  envioId: string;
  estado?: string | null;
  resolution?: string | null;
  appWebUrl?: string | null;
  appDeepLink?: string | null;
  trackingUrl?: string | null;
  supportHint?: string | null;
};

export type FlipyCancelShipmentSuccessResult = {
  blocked: false;
  envioId: string;
  estado: string;
  estadoPrevio?: string | null;
  idempotent: boolean;
  holdLiberado?: boolean | null;
  message?: string | null;
  appWebUrl?: string | null;
  trackingUrl?: string | null;
};

export type FlipyCancelShipmentResult = FlipyCancelShipmentSuccessResult | FlipyCancelShipmentBlockedResult;

type OrderRow = {
  id: string;
  store_id: string;
  external_order_id: string;
  order_number: string | null;
  metadata: Json;
};

function readMeta(metadata: Json): Record<string, unknown> {
  if (metadata && typeof metadata === "object" && !Array.isArray(metadata)) {
    return metadata as Record<string, unknown>;
  }
  return {};
}

async function patchOrderAfterFlipyCancel(
  admin: JobsAdminClient,
  input: {
    orderId: string;
    storeId: string;
    result: FlipyCancelEnvioSuccessResult;
    cancelledByUserId?: string | null;
  },
) {
  const orderRes = await admin
    .from("orders")
    .select("metadata")
    .eq("id", input.orderId)
    .eq("store_id", input.storeId)
    .maybeSingle();
  if (!orderRes.data) return;

  const meta = readMeta(orderRes.data.metadata);
  const now = new Date().toISOString();
  const nextMeta = {
    ...meta,
    flipy_envio_id: input.result.envioId,
    flipy_estado: input.result.estado,
    flipy_tracking_url: input.result.trackingUrl ?? meta.flipy_tracking_url ?? null,
    flipy_cancelacion: {
      at: now,
      idempotent: input.result.idempotent,
      estadoPrevio: input.result.estadoPrevio ?? null,
      holdLiberado: input.result.holdLiberado ?? null,
      cancelledBy: input.cancelledByUserId ?? null,
      message: input.result.message ?? null,
    },
  };

  await admin
    .from("orders")
    .update({ metadata: nextMeta as Json, updated_at: now })
    .eq("id", input.orderId)
    .eq("store_id", input.storeId);
}

export async function cancelFlipyShipmentForOrder(input: {
  admin: JobsAdminClient;
  agencyId: string;
  storeId: string;
  orderId: string;
  envioId?: string | null;
  cancelInput?: FlipyCancelEnvioInput;
  cancelledByUserId?: string | null;
}): Promise<FlipyCancelShipmentResult> {
  const orderRes = await input.admin
    .from("orders")
    .select("id, store_id, external_order_id, order_number, metadata")
    .eq("id", input.orderId)
    .eq("store_id", input.storeId)
    .maybeSingle();
  if (!orderRes.data) {
    throw new ValidationError("Pedido no encontrado.");
  }

  const order = orderRes.data as OrderRow;
  const meta = readMeta(order.metadata);
  const envioId =
    input.envioId?.trim() ||
    (typeof meta.flipy_envio_id === "string" ? meta.flipy_envio_id.trim() : "");
  if (!envioId) {
    throw new ValidationError("Este pedido no tiene envío Flipy vinculado.");
  }

  const client = await getFlipyClientForStore(input.agencyId, input.storeId);
  const externalOrderId = `shopify:${order.external_order_id}`;
  const cancelBody: FlipyCancelEnvioInput = {
    motivo: input.cancelInput?.motivo ?? "CLIENTE_CANCELADO",
    motivoLabel:
      input.cancelInput?.motivoLabel ??
      `Cliente canceló el pedido${order.order_number ? ` #${order.order_number.replace(/^#/, "")}` : ""}`,
    notas: input.cancelInput?.notas,
  };

  try {
    const cancelled = await client.cancelEnvio(envioId, cancelBody);
    await patchOrderAfterFlipyCancel(input.admin, {
      orderId: order.id,
      storeId: input.storeId,
      result: cancelled,
      cancelledByUserId: input.cancelledByUserId,
    });
    return {
      blocked: false,
      envioId: cancelled.envioId,
      estado: cancelled.estado,
      estadoPrevio: cancelled.estadoPrevio,
      idempotent: cancelled.idempotent,
      holdLiberado: cancelled.holdLiberado,
      message: cancelled.message,
      appWebUrl: cancelled.appWebUrl,
      trackingUrl: cancelled.trackingUrl,
    };
  } catch (error) {
    if (error instanceof FlipyPartnerApiError && error.status === 409) {
      const details = error.details;
      return {
        blocked: true,
        code: error.code ?? "CANCEL_BLOQUEADA",
        message: error.message,
        envioId: details?.envioId ?? envioId,
        estado: details?.estado ?? null,
        resolution: details?.resolution ?? null,
        appWebUrl: details?.appWebUrl ?? null,
        appDeepLink: details?.appDeepLink ?? null,
        trackingUrl: details?.trackingUrl ?? null,
        supportHint: details?.supportHint ?? null,
      };
    }

    if (error instanceof FlipyPartnerApiError && error.status === 404) {
      const lookup = await client.getEnvioByExternalOrder(externalOrderId).catch(() => null);
      if (!lookup) {
        throw error;
      }
      if (lookup.envioId !== envioId) {
        throw new ValidationError("El envío Flipy vinculado no coincide con el pedido.");
      }
      throw error;
    }

    throw error;
  }
}
