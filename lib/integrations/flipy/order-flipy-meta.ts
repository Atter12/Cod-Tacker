import type {
  FlipyDevolucionInfo,
  FlipyEnvioSummaryResult,
  FlipyTiendaResena,
} from "@/lib/integrations/flipy/partner-contract";
import type { JobsAdminClient } from "@/lib/jobs/types";
import type { Json } from "@/types/database.generated";

function readMeta(metadata: Json): Record<string, unknown> {
  if (metadata && typeof metadata === "object" && !Array.isArray(metadata)) {
    return metadata as Record<string, unknown>;
  }
  return {};
}

export type FlipyEnvioMetaPatch = {
  orderId: string;
  storeId: string;
  estado: string;
  envioId?: string | null;
  trackingUrl?: string | null;
  devolucion?: FlipyDevolucionInfo | null;
  tiendaResena?: FlipyTiendaResena | null;
  calificacionDisponible?: boolean | null;
  calificacionPeso?: number | null;
};

export async function patchOrderFlipyEnvioMeta(
  admin: JobsAdminClient,
  input: FlipyEnvioMetaPatch,
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
  const nextMeta: Record<string, unknown> = {
    ...meta,
    flipy_estado: input.estado,
    ...(input.envioId ? { flipy_envio_id: input.envioId } : {}),
    ...(input.trackingUrl ? { flipy_tracking_url: input.trackingUrl } : {}),
    flipy_webhook: {
      ...(typeof meta.flipy_webhook === "object" &&
      meta.flipy_webhook &&
      !Array.isArray(meta.flipy_webhook)
        ? (meta.flipy_webhook as Record<string, unknown>)
        : {}),
      lastStatus: input.estado,
      lastStatusAt: now,
    },
  };

  if (input.devolucion !== undefined) {
    nextMeta.flipy_devolucion = input.devolucion;
  }
  if (input.tiendaResena !== undefined) {
    nextMeta.flipy_tienda_resena = input.tiendaResena;
  }
  if (input.calificacionDisponible !== undefined) {
    nextMeta.flipy_calificacion_disponible = input.calificacionDisponible;
  }
  if (input.calificacionPeso !== undefined) {
    nextMeta.flipy_calificacion_peso = input.calificacionPeso;
  }

  await admin
    .from("orders")
    .update({ metadata: nextMeta as Json, updated_at: now })
    .eq("id", input.orderId)
    .eq("store_id", input.storeId);
}

export function flipyEnvioSummaryToMetaPatch(
  summary: FlipyEnvioSummaryResult,
): Pick<
  FlipyEnvioMetaPatch,
  | "estado"
  | "envioId"
  | "trackingUrl"
  | "devolucion"
  | "tiendaResena"
  | "calificacionDisponible"
  | "calificacionPeso"
> {
  return {
    estado: summary.estado,
    envioId: summary.envioId,
    trackingUrl: summary.trackingUrl,
    devolucion: summary.devolucion ?? null,
    tiendaResena: summary.tiendaResena ?? null,
    calificacionDisponible: summary.calificacionDisponible ?? null,
    calificacionPeso: summary.calificacionPeso ?? null,
  };
}

/** @deprecated Use patchOrderFlipyEnvioMeta */
export async function patchOrderFlipyEstadoMeta(
  admin: JobsAdminClient,
  input: FlipyEnvioMetaPatch,
) {
  return patchOrderFlipyEnvioMeta(admin, input);
}
