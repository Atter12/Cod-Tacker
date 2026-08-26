import "server-only";

import { ValidationError } from "@/lib/errors";
import type {
  FlipyCalificarEnvioInput,
  FlipyCalificarEnvioSuccessResult,
  FlipyMotorizadoCalificacionStats,
  FlipyTiendaResena,
} from "@/lib/integrations/flipy/partner-contract";
import { FlipyPartnerApiError } from "@/lib/integrations/flipy/errors";
import { getFlipyClientForStore } from "@/lib/integrations/flipy/cotizar-flete-service";
import { patchOrderFlipyEnvioMeta } from "@/lib/integrations/flipy/order-flipy-meta";
import type { JobsAdminClient } from "@/lib/jobs/types";
import type { Json } from "@/types/database.generated";

export type FlipyCalificarEnvioBlockedResult = {
  blocked: true;
  code: string;
  message: string;
  envioId: string;
  estado?: string | null;
};

export type FlipyCalificarEnvioSuccess = {
  blocked: false;
  envioId: string;
  estado: string;
  idempotent: boolean;
  message?: string | null;
  tiendaResena?: FlipyTiendaResena | null;
  calificacionDisponible?: boolean | null;
  calificacionPeso?: number | null;
  motorizado?: FlipyMotorizadoCalificacionStats | null;
};

export type FlipyCalificarEnvioResult = FlipyCalificarEnvioSuccess | FlipyCalificarEnvioBlockedResult;

type OrderRow = {
  id: string;
  store_id: string;
  metadata: Json;
};

function readMeta(metadata: Json): Record<string, unknown> {
  if (metadata && typeof metadata === "object" && !Array.isArray(metadata)) {
    return metadata as Record<string, unknown>;
  }
  return {};
}

function validateRating(rating: number): number {
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    throw new ValidationError("La calificación debe ser un entero entre 1 y 5.");
  }
  return rating;
}

async function patchOrderAfterFlipyCalificacion(
  admin: JobsAdminClient,
  input: {
    orderId: string;
    storeId: string;
    result: FlipyCalificarEnvioSuccessResult;
    ratedByUserId?: string | null;
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
    flipy_tienda_resena: input.result.tiendaResena ?? null,
    flipy_calificacion_disponible: input.result.calificacionDisponible ?? false,
    flipy_calificacion_peso: input.result.calificacionPeso ?? null,
    flipy_motorizado_calificacion: input.result.motorizado ?? null,
    flipy_calificacion: {
      at: now,
      idempotent: input.result.idempotent,
      ratedBy: input.ratedByUserId ?? null,
      message: input.result.message ?? null,
    },
  };

  await admin
    .from("orders")
    .update({ metadata: nextMeta as Json, updated_at: now })
    .eq("id", input.orderId)
    .eq("store_id", input.storeId);
}

export async function calificarFlipyMotorizadoForOrder(input: {
  admin: JobsAdminClient;
  agencyId: string;
  storeId: string;
  orderId: string;
  envioId?: string | null;
  calificarInput: FlipyCalificarEnvioInput;
  ratedByUserId?: string | null;
}): Promise<FlipyCalificarEnvioResult> {
  const orderRes = await input.admin
    .from("orders")
    .select("id, store_id, metadata")
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

  const rating = validateRating(input.calificarInput.rating);
  const client = await getFlipyClientForStore(input.agencyId, input.storeId);

  try {
    const result = await client.calificarEnvio(envioId, {
      rating,
      comentario: input.calificarInput.comentario,
    });
    await patchOrderAfterFlipyCalificacion(input.admin, {
      orderId: order.id,
      storeId: input.storeId,
      result,
      ratedByUserId: input.ratedByUserId,
    });
    return {
      blocked: false,
      envioId: result.envioId,
      estado: result.estado,
      idempotent: result.idempotent,
      message: result.message,
      tiendaResena: result.tiendaResena,
      calificacionDisponible: result.calificacionDisponible,
      calificacionPeso: result.calificacionPeso,
      motorizado: result.motorizado,
    };
  } catch (error) {
    if (error instanceof FlipyPartnerApiError && error.status === 409) {
      return {
        blocked: true,
        code: error.code ?? "CALIFICACION_NO_DISPONIBLE",
        message: error.message,
        envioId: error.details?.envioId ?? envioId,
        estado: error.details?.estado ?? null,
      };
    }
    throw error;
  }
}
