import "server-only";

import { ValidationError } from "@/lib/errors";
import type {
  FlipyConfirmarDevolucionInput,
  FlipyConfirmarDevolucionSuccessResult,
  FlipyDevolucionInfo,
  FlipyEnvioSummaryResult,
} from "@/lib/integrations/flipy/partner-contract";
import { FlipyPartnerApiError } from "@/lib/integrations/flipy/errors";
import { getFlipyClientForStore } from "@/lib/integrations/flipy/cotizar-flete-service";
import { patchOrderFlipyEnvioMeta, flipyEnvioSummaryToMetaPatch } from "@/lib/integrations/flipy/order-flipy-meta";
import type { JobsAdminClient } from "@/lib/jobs/types";
import type { Json } from "@/types/database.generated";

export type FlipyConfirmDevolucionBlockedResult = {
  blocked: true;
  code: string;
  message: string;
  envioId: string;
  estado?: string | null;
  devolucion?: FlipyDevolucionInfo | null;
};

export type FlipyConfirmDevolucionSuccessResult = {
  blocked: false;
  envioId: string;
  estado: string;
  estadoPrevio?: string | null;
  idempotent: boolean;
  montoLiberado?: number | null;
  message?: string | null;
  devolucion?: FlipyDevolucionInfo | null;
};

export type FlipyConfirmDevolucionResult =
  | FlipyConfirmDevolucionSuccessResult
  | FlipyConfirmDevolucionBlockedResult;

type OrderRow = {
  id: string;
  store_id: string;
  external_order_id: string;
  metadata: Json;
};

function readMeta(metadata: Json): Record<string, unknown> {
  if (metadata && typeof metadata === "object" && !Array.isArray(metadata)) {
    return metadata as Record<string, unknown>;
  }
  return {};
}

async function patchOrderAfterFlipyDevolucionConfirm(
  admin: JobsAdminClient,
  input: {
    orderId: string;
    storeId: string;
    result: FlipyConfirmarDevolucionSuccessResult;
    confirmedByUserId?: string | null;
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
    flipy_devolucion: input.result.devolucion ?? {
      estado: "CONFIRMADA",
      pendienteConfirmacion: false,
      confirmadaAt: now,
      confirmadaPor: "PARTNER",
    },
    flipy_devolucion_confirmacion: {
      at: now,
      idempotent: input.result.idempotent,
      estadoPrevio: input.result.estadoPrevio ?? null,
      montoLiberado: input.result.montoLiberado ?? null,
      confirmedBy: input.confirmedByUserId ?? null,
      message: input.result.message ?? null,
    },
  };

  await admin
    .from("orders")
    .update({ metadata: nextMeta as Json, updated_at: now })
    .eq("id", input.orderId)
    .eq("store_id", input.storeId);
}

export async function syncFlipyEnvioForOrder(input: {
  admin: JobsAdminClient;
  agencyId: string;
  storeId: string;
  orderId: string;
  envioId?: string | null;
}): Promise<FlipyEnvioSummaryResult> {
  const orderRes = await input.admin
    .from("orders")
    .select("id, store_id, external_order_id, metadata")
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
  const summary = await client.getEnvio(envioId);

  await patchOrderFlipyEnvioMeta(input.admin, {
    orderId: order.id,
    storeId: input.storeId,
    ...flipyEnvioSummaryToMetaPatch(summary),
  });

  return summary;
}

export async function confirmFlipyDevolucionForOrder(input: {
  admin: JobsAdminClient;
  agencyId: string;
  storeId: string;
  orderId: string;
  envioId?: string | null;
  confirmInput?: FlipyConfirmarDevolucionInput;
  confirmedByUserId?: string | null;
}): Promise<FlipyConfirmDevolucionResult> {
  const orderRes = await input.admin
    .from("orders")
    .select("id, store_id, external_order_id, metadata")
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

  try {
    const confirmed = await client.confirmarDevolucion(envioId, input.confirmInput ?? {});
    await patchOrderAfterFlipyDevolucionConfirm(input.admin, {
      orderId: order.id,
      storeId: input.storeId,
      result: confirmed,
      confirmedByUserId: input.confirmedByUserId,
    });
    return {
      blocked: false,
      envioId: confirmed.envioId,
      estado: confirmed.estado,
      estadoPrevio: confirmed.estadoPrevio,
      idempotent: confirmed.idempotent,
      montoLiberado: confirmed.montoLiberado,
      message: confirmed.message,
      devolucion: confirmed.devolucion,
    };
  } catch (error) {
    if (error instanceof FlipyPartnerApiError && error.status === 409) {
      return {
        blocked: true,
        code: error.code ?? "SIN_DEVOLUCION_PENDIENTE",
        message: error.message,
        envioId: error.details?.envioId ?? envioId,
        estado: error.details?.estado ?? null,
        devolucion: error.details?.devolucion ?? null,
      };
    }
    throw error;
  }
}
