"use server";

import { revalidatePath } from "next/cache";
import { routes } from "@/config/routes";
import { actionFail, actionOk, type ActionResult } from "@/lib/actions/action-result";
import { ValidationError } from "@/lib/errors";
import { createFlipyShipmentForOrder } from "@/lib/integrations/flipy/create-shipment-service";
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
  appWebUrl?: string | null;
  appDeepLink?: string | null;
  pujasWebUrl?: string | null;
};

export async function createFlipyShipmentFromOrder(input: {
  agencySlug: string;
  storeSlug: string;
  orderId: string;
  escenarioPago: FlipyEscenarioPago;
  destination: { address: string; lat: number; lng: number };
  fletePrice?: number | null;
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

    const fleteCheck = validateFlipyFletePrice(input.escenarioPago, input.fletePrice);
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
