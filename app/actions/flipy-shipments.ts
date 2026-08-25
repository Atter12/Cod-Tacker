"use server";

import { revalidatePath } from "next/cache";
import { routes } from "@/config/routes";
import { actionFail, actionOk, type ActionResult } from "@/lib/actions/action-result";
import { IntegrationError, ValidationError } from "@/lib/errors";
import { createFlipyShipmentForOrder } from "@/lib/integrations/flipy/create-shipment-service";
import {
  readFlipyTiendaId,
  resolveFlipyPartnerKeyFromIntegration,
} from "@/lib/integrations/flipy/credentials";
import { createFlipyPartnerClient, type FlipyFleteQuote, type FlipyPackageCareId, type FlipyPackageSize } from "@/lib/integrations/flipy/client";
import {
  flipyErrorUserHint,
  readFlipyErrorCode,
} from "@/lib/integrations/flipy/errors";
import { getFlipyEnv } from "@/lib/integrations/flipy/env";
import { validateFlipyFletePrice } from "@/lib/integrations/flipy/flete-rules";
import type { FlipyEscenarioPago } from "@/lib/integrations/flipy/resolve-payment";
import { resolveFlipyIntegrationForStore } from "@/lib/integrations/flipy/webhook-ingress";
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

    const admin = createAdminClient();
    const integration = await resolveFlipyIntegrationForStore(
      admin,
      membership.agencyId,
      membership.storeId,
    );
    if (!integration || integration.status === "disconnected") {
      throw new IntegrationError("Conecta Flipy en Integraciones antes de cotizar.");
    }

    const partnerKey = resolveFlipyPartnerKeyFromIntegration(integration);
    if (!partnerKey) {
      throw new IntegrationError("FLIPY_PARTNER_API_KEY no configurada.");
    }

    const flipyTiendaId = readFlipyTiendaId(integration.settings) ?? integration.external_account_id;
    if (!flipyTiendaId) {
      throw new IntegrationError("Integración Flipy sin tiendaId. Reconecta Flipy.");
    }

    const env = getFlipyEnv();
    const client = createFlipyPartnerClient({
      baseUrl: env.apiBaseUrl,
      partnerKey,
      partnerId: env.partnerId,
      externalStoreId: membership.storeId,
    });

    const quoted = await client.cotizarEnvio({
      originLat: input.originLat,
      originLng: input.originLng,
      destinationLat: input.destinationLat,
      destinationLng: input.destinationLng,
      packageSize: input.packageSize ?? "mediano",
      typeMode: input.typeMode ?? "express",
    });

    return actionOk({ fleteQuote: quoted.fleteQuote });
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
