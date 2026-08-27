"use server";

import { revalidatePath } from "next/cache";
import { routes } from "@/config/routes";
import { actionFail, actionOk, type ActionResult } from "@/lib/actions/action-result";
import { IntegrationError, ValidationError } from "@/lib/errors";
import { createFlipyShipmentForOrder } from "@/lib/integrations/flipy/create-shipment-service";
import { cancelFlipyShipmentForOrder } from "@/lib/integrations/flipy/cancel-shipment-service";
import { calificarFlipyMotorizadoForOrder } from "@/lib/integrations/flipy/calificar-envio-service";
import {
  confirmFlipyDevolucionForOrder,
  syncFlipyEnvioForOrder,
} from "@/lib/integrations/flipy/confirm-devolucion-service";
import { cotizarFlipyFleteForStore, geocodeFlipyAddressForStore } from "@/lib/integrations/flipy/cotizar-flete-service";
import type { FlipyPackageCareId, FlipyPackageSize } from "@/lib/integrations/flipy/client";
import type { FlipyDevolucionInfo, FlipyFleteQuote, FlipyTiendaResena } from "@/lib/integrations/flipy/partner-contract";
import {
  flipyErrorUserHint,
  readFlipyErrorCode,
} from "@/lib/integrations/flipy/errors";
import { validateFlipyFletePrice } from "@/lib/integrations/flipy/flete-rules";
import type { FlipyEscenarioPago } from "@/lib/integrations/flipy/resolve-payment";
import { getIntegrationRuntimeMode } from "@/lib/integrations/registry";
import { assertCanManageOrders } from "@/lib/orders/transitions";
import { can } from "@/lib/permissions/can";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireStoreAccess } from "@/lib/tenant/require-store-access";
import { requireUser } from "@/lib/auth/require-user";
import { toUserMessage } from "@/lib/errors/to-user-message";

export type CreateFlipyShipmentResult = {
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

export type CotizarFlipyFleteResult = {
  fleteQuote: FlipyFleteQuote;
};

export type CancelFlipyShipmentResult = {
  success: boolean;
  blocked?: boolean;
  envioId?: string;
  estado?: string;
  idempotent?: boolean;
  message?: string | null;
  appWebUrl?: string | null;
  trackingUrl?: string | null;
  supportHint?: string | null;
  resolution?: string | null;
};

export type ConfirmFlipyDevolucionResult = {
  success: boolean;
  blocked?: boolean;
  envioId?: string;
  estado?: string;
  idempotent?: boolean;
  message?: string | null;
  montoLiberado?: number | null;
  devolucion?: FlipyDevolucionInfo | null;
};

export type RefreshFlipyEnvioResult = {
  envioId: string;
  estado: string;
  devolucion?: FlipyDevolucionInfo | null;
  devolucionPendiente: boolean;
  calificacionDisponible: boolean;
  calificacionPeso?: number | null;
  tiendaResena?: FlipyTiendaResena | null;
};

export type CalificarFlipyMotorizadoResult = {
  success: boolean;
  blocked?: boolean;
  envioId?: string;
  estado?: string;
  idempotent?: boolean;
  message?: string | null;
  tiendaResena?: FlipyTiendaResena | null;
  calificacionPeso?: number | null;
  motorizadoPromedio?: number | null;
};

export async function calificarFlipyMotorizado(input: {
  agencySlug: string;
  storeSlug: string;
  orderId: string;
  envioId?: string | null;
  rating: number;
  comentario?: string | null;
}): Promise<ActionResult<CalificarFlipyMotorizadoResult> & { errorCode?: string }> {
  try {
    if (getIntegrationRuntimeMode() !== "live") {
      throw new ValidationError("Calificar motorizado Flipy requiere INTEGRATION_MODE=live.");
    }

    const user = await requireUser();
    const membership = await requireStoreAccess(input.agencySlug, input.storeSlug);
    assertCanManageOrders(can(membership.roles, "orders.manage"));
    if (!membership.storeId) throw new ValidationError("Tienda inválida.");

    const admin = createAdminClient();
    const result = await calificarFlipyMotorizadoForOrder({
      admin,
      agencyId: membership.agencyId,
      storeId: membership.storeId,
      orderId: input.orderId,
      envioId: input.envioId,
      ratedByUserId: user.id,
      calificarInput: {
        rating: input.rating,
        comentario: input.comentario,
      },
    });

    revalidatePath(routes.store.orderDetail(input.agencySlug, input.storeSlug, input.orderId));

    if (result.blocked) {
      return {
        success: false,
        blocked: true,
        envioId: result.envioId,
        estado: result.estado ?? undefined,
        message: result.message,
        errorCode: result.code,
        error: result.message,
      };
    }

    return actionOk({
      success: true,
      blocked: false,
      envioId: result.envioId,
      estado: result.estado,
      idempotent: result.idempotent,
      message: result.message,
      tiendaResena: result.tiendaResena ?? null,
      calificacionPeso: result.calificacionPeso,
      motorizadoPromedio: result.motorizado?.calificacionPromedio ?? null,
    });
  } catch (error) {
    const errorCode = readFlipyErrorCode(error);
    const hint = flipyErrorUserHint(errorCode);
    const message = hint ?? toUserMessage(error);
    if (errorCode) {
      return { error: message, errorCode, success: false };
    }
    return { ...actionFail(error), success: false };
  }
}

export async function refreshFlipyEnvioStatus(input: {
  agencySlug: string;
  storeSlug: string;
  orderId: string;
  envioId?: string | null;
}): Promise<ActionResult<RefreshFlipyEnvioResult> & { errorCode?: string }> {
  try {
    if (getIntegrationRuntimeMode() !== "live") {
      throw new ValidationError("Sincronizar envío Flipy requiere INTEGRATION_MODE=live.");
    }

    await requireUser();
    const membership = await requireStoreAccess(input.agencySlug, input.storeSlug);
    assertCanManageOrders(can(membership.roles, "orders.manage"));
    if (!membership.storeId) throw new ValidationError("Tienda inválida.");

    const admin = createAdminClient();
    const summary = await syncFlipyEnvioForOrder({
      admin,
      agencyId: membership.agencyId,
      storeId: membership.storeId,
      orderId: input.orderId,
      envioId: input.envioId,
    });

    revalidatePath(routes.store.orderDetail(input.agencySlug, input.storeSlug, input.orderId));

    return actionOk({
      envioId: summary.envioId,
      estado: summary.estado,
      devolucion: summary.devolucion ?? null,
      devolucionPendiente: Boolean(summary.devolucion?.pendienteConfirmacion),
      calificacionDisponible: summary.calificacionDisponible === true,
      calificacionPeso: summary.calificacionPeso ?? null,
      tiendaResena: summary.tiendaResena ?? null,
    });
  } catch (error) {
    const errorCode = readFlipyErrorCode(error);
    const hint = flipyErrorUserHint(errorCode);
    const message = hint ?? toUserMessage(error);
    if (errorCode) {
      return { error: message, errorCode };
    }
    return actionFail(error);
  }
}

export async function confirmFlipyDevolucion(input: {
  agencySlug: string;
  storeSlug: string;
  orderId: string;
  envioId?: string | null;
  notas?: string | null;
}): Promise<ActionResult<ConfirmFlipyDevolucionResult> & { errorCode?: string }> {
  try {
    if (getIntegrationRuntimeMode() !== "live") {
      throw new ValidationError("Confirmar devolución Flipy requiere INTEGRATION_MODE=live.");
    }

    const user = await requireUser();
    const membership = await requireStoreAccess(input.agencySlug, input.storeSlug);
    assertCanManageOrders(can(membership.roles, "orders.manage"));
    if (!membership.storeId) throw new ValidationError("Tienda inválida.");

    const admin = createAdminClient();
    const result = await confirmFlipyDevolucionForOrder({
      admin,
      agencyId: membership.agencyId,
      storeId: membership.storeId,
      orderId: input.orderId,
      envioId: input.envioId,
      confirmedByUserId: user.id,
      confirmInput: { notas: input.notas },
    });

    revalidatePath(routes.store.orderDetail(input.agencySlug, input.storeSlug, input.orderId));
    revalidatePath(routes.store.operations(input.agencySlug, input.storeSlug));

    if (result.blocked) {
      return {
        success: false,
        blocked: true,
        envioId: result.envioId,
        estado: result.estado ?? undefined,
        message: result.message,
        devolucion: result.devolucion ?? null,
        errorCode: result.code,
        error: result.message,
      };
    }

    return actionOk({
      success: true,
      blocked: false,
      envioId: result.envioId,
      estado: result.estado,
      idempotent: result.idempotent,
      message: result.message,
      montoLiberado: result.montoLiberado,
      devolucion: result.devolucion ?? null,
    });
  } catch (error) {
    const errorCode = readFlipyErrorCode(error);
    const hint = flipyErrorUserHint(errorCode);
    const message = hint ?? toUserMessage(error);
    if (errorCode) {
      return { error: message, errorCode, success: false };
    }
    return { ...actionFail(error), success: false };
  }
}

export async function cancelFlipyShipment(input: {
  agencySlug: string;
  storeSlug: string;
  orderId: string;
  envioId?: string | null;
  motivoLabel?: string | null;
  notas?: string | null;
}): Promise<ActionResult<CancelFlipyShipmentResult> & { errorCode?: string }> {
  try {
    if (getIntegrationRuntimeMode() !== "live") {
      throw new ValidationError("Cancelar envío Flipy requiere INTEGRATION_MODE=live.");
    }

    const user = await requireUser();
    const membership = await requireStoreAccess(input.agencySlug, input.storeSlug);
    assertCanManageOrders(can(membership.roles, "orders.manage"));
    if (!membership.storeId) throw new ValidationError("Tienda inválida.");

    const admin = createAdminClient();
    const result = await cancelFlipyShipmentForOrder({
      admin,
      agencyId: membership.agencyId,
      storeId: membership.storeId,
      orderId: input.orderId,
      envioId: input.envioId,
      cancelledByUserId: user.id,
      cancelInput: {
        motivo: "CLIENTE_CANCELADO",
        motivoLabel: input.motivoLabel,
        notas: input.notas,
      },
    });

    revalidatePath(routes.store.orderDetail(input.agencySlug, input.storeSlug, input.orderId));
    revalidatePath(routes.store.operations(input.agencySlug, input.storeSlug));
    revalidatePath(routes.store.flipy(input.agencySlug, input.storeSlug));

    if (result.blocked) {
      return {
        success: false,
        blocked: true,
        envioId: result.envioId,
        estado: result.estado ?? undefined,
        message: result.message,
        appWebUrl: result.appWebUrl,
        trackingUrl: result.trackingUrl,
        supportHint: result.supportHint,
        resolution: result.resolution,
        errorCode: result.code,
        error: result.message,
      };
    }

    return actionOk({
      success: true,
      blocked: false,
      envioId: result.envioId,
      estado: result.estado,
      idempotent: result.idempotent,
      message: result.message,
      appWebUrl: result.appWebUrl,
      trackingUrl: result.trackingUrl,
    });
  } catch (error) {
    const errorCode = readFlipyErrorCode(error);
    const hint = flipyErrorUserHint(errorCode);
    const message = hint ?? toUserMessage(error);
    if (errorCode) {
      return { error: message, errorCode, success: false };
    }
    return { ...actionFail(error), success: false };
  }
}

export async function cotizarFlipyFlete(input: {
  agencySlug: string;
  storeSlug: string;
  originLat: number;
  originLng: number;
  destinationLat: number;
  destinationLng: number;
  packageSize?: FlipyPackageSize;
  typeMode?: "express" | "programado" | "recurrente";
}): Promise<ActionResult<CotizarFlipyFleteResult> & { errorCode?: string }> {
  try {
    if (getIntegrationRuntimeMode() !== "live") {
      throw new ValidationError("Cotizar flete Flipy requiere INTEGRATION_MODE=live.");
    }

    const coords = [
      input.originLat,
      input.originLng,
      input.destinationLat,
      input.destinationLng,
    ];
    if (coords.some((value) => !Number.isFinite(value))) {
      throw new ValidationError("Coordenadas de origen y destino inválidas.");
    }

    await requireUser();
    const membership = await requireStoreAccess(input.agencySlug, input.storeSlug);
    assertCanManageOrders(can(membership.roles, "orders.manage"));
    if (!membership.storeId) throw new ValidationError("Tienda inválida.");

    const fleteQuote = await cotizarFlipyFleteForStore({
      agencyId: membership.agencyId,
      storeId: membership.storeId,
      originLat: input.originLat,
      originLng: input.originLng,
      destinationLat: input.destinationLat,
      destinationLng: input.destinationLng,
      packageSize: input.packageSize,
      typeMode: input.typeMode,
    });

    return actionOk({ fleteQuote });
  } catch (error) {
    const errorCode = readFlipyErrorCode(error);
    const hint = flipyErrorUserHint(errorCode);
    const message = hint ?? toUserMessage(error);
    if (errorCode) {
      return { error: message, errorCode };
    }
    return actionFail(error);
  }
}

export type GeocodeFlipyDeliveryResult = {
  address: string;
  lat: number;
  lng: number;
};

export async function geocodeFlipyDeliveryAddress(input: {
  agencySlug: string;
  storeSlug: string;
  address: string;
}): Promise<ActionResult<GeocodeFlipyDeliveryResult>> {
  try {
    if (getIntegrationRuntimeMode() !== "live") {
      throw new ValidationError("Geocodificar dirección Flipy requiere INTEGRATION_MODE=live.");
    }

    const query = input.address.trim();
    if (query.length < 4) {
      throw new ValidationError("Dirección demasiado corta para geocodificar.");
    }

    await requireUser();
    const membership = await requireStoreAccess(input.agencySlug, input.storeSlug);
    assertCanManageOrders(can(membership.roles, "orders.manage"));
    if (!membership.storeId) throw new ValidationError("Tienda inválida.");

    const geocoded = await geocodeFlipyAddressForStore({
      agencyId: membership.agencyId,
      storeId: membership.storeId,
      address: query,
    });
    if (!geocoded) {
      throw new ValidationError("No se pudo geocodificar la dirección de Shopify.");
    }

    return actionOk(geocoded);
  } catch (error) {
    return actionFail(error);
  }
}

export async function createFlipyShipmentFromOrder(input: {
  agencySlug: string;
  storeSlug: string;
  orderId: string;
  escenarioPago: FlipyEscenarioPago;
  destination: { address: string; lat: number; lng: number };
  fletePrice?: number | null;
  fleteQuote?: FlipyFleteQuote | null;
  packageSize?: FlipyPackageSize;
  packageCare?: FlipyPackageCareId[];
  packageCareNote?: string | null;
  destinationEmail?: string | null;
  smartEligible?: boolean;
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
}): Promise<ActionResult<CreateFlipyShipmentResult> & { errorCode?: string }> {
  try {
    if (getIntegrationRuntimeMode() !== "live") {
      throw new ValidationError("Crear envío Flipy requiere INTEGRATION_MODE=live.");
    }

    const fleteCheck = validateFlipyFletePrice(input.escenarioPago, input.fletePrice, {
      smartEligible: input.smartEligible,
      fleteQuote: input.fleteQuote,
    });
    if (!fleteCheck.ok) {
      throw new ValidationError(fleteCheck.error ?? "Oferta de flete inválida.");
    }
    if (!input.destination.address.trim()) {
      throw new ValidationError("La dirección de entrega es requerida.");
    }

    const user = await requireUser();
    const membership = await requireStoreAccess(input.agencySlug, input.storeSlug);
    assertCanManageOrders(can(membership.roles, "orders.manage"));
    if (!membership.storeId) throw new ValidationError("Tienda inválida.");

    const admin = createAdminClient();
    const created = await createFlipyShipmentForOrder({
      admin,
      agencyId: membership.agencyId,
      storeId: membership.storeId,
      orderId: input.orderId,
      escenarioPago: input.escenarioPago,
      destination: input.destination,
      fletePrice: fleteCheck.value,
      fleteQuote: input.fleteQuote,
      packageSize: input.packageSize,
      packageCare: input.packageCare,
      packageCareNote: input.packageCareNote,
      destinationEmail: input.destinationEmail,
      origin: input.origin,
      destinationContact: input.destinationContact,
      notes: input.notes,
      confirmedByUserId: user.id,
      source: "manual",
    });

    revalidatePath(routes.store.orderDetail(input.agencySlug, input.storeSlug, input.orderId));
    revalidatePath(routes.store.operations(input.agencySlug, input.storeSlug));

    return actionOk(created);
  } catch (error) {
    const errorCode = readFlipyErrorCode(error);
    const hint = flipyErrorUserHint(errorCode);
    const message = hint ?? toUserMessage(error);
    if (errorCode) {
      return { error: message, errorCode };
    }
    return actionFail(error);
  }
}
