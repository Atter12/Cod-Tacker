"use server";

import { revalidatePath } from "next/cache";
import { routes } from "@/config/routes";
import { actionFail, actionOk, type ActionResult } from "@/lib/actions/action-result";
import { ValidationError } from "@/lib/errors";
import { toUserMessage } from "@/lib/errors/to-user-message";
import { getFlipyClientForStore } from "@/lib/integrations/flipy/cotizar-flete-service";
import {
  flipyErrorUserHint,
  readFlipyErrorCode,
} from "@/lib/integrations/flipy/errors";
import {
  listFlipyInboxForStore,
  type FlipyInboxResult,
} from "@/lib/integrations/flipy/inbox-service";
import type { FlipyEnviosInboxScope } from "@/lib/integrations/flipy/partner-contract";
import { getIntegrationRuntimeMode } from "@/lib/integrations/registry";
import { assertCanManageOrders } from "@/lib/orders/transitions";
import { can } from "@/lib/permissions/can";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireStoreAccess } from "@/lib/tenant/require-store-access";
import { requireUser } from "@/lib/auth/require-user";

export type RejectFlipyOfertaResult = {
  envioId: string;
  ofertaId: string;
  estado?: string | null;
  message?: string | null;
  bidsRemaining?: number | null;
};

export async function loadFlipyInbox(input: {
  agencySlug: string;
  storeSlug: string;
  scope?: FlipyEnviosInboxScope;
  estado?: string | null;
  q?: string | null;
  page?: number;
  pageSize?: number;
}): Promise<ActionResult<FlipyInboxResult>> {
  try {
    await requireUser();
    const membership = await requireStoreAccess(input.agencySlug, input.storeSlug);
    if (!can(membership.roles, "orders.view") && !can(membership.roles, "shipments.view")) {
      throw new ValidationError("No tienes permiso para ver el inbox Flipy.");
    }
    if (!membership.storeId) throw new ValidationError("Tienda inválida.");

    const admin = createAdminClient();
    const result = await listFlipyInboxForStore({
      admin,
      agencyId: membership.agencyId,
      storeId: membership.storeId,
      scope: input.scope,
      estado: input.estado,
      q: input.q,
      page: input.page,
      pageSize: input.pageSize,
    });
    return actionOk(result);
  } catch (error) {
    const errorCode = readFlipyErrorCode(error);
    const hint = flipyErrorUserHint(errorCode);
    return actionFail(hint ? new ValidationError(hint) : error);
  }
}

export async function rejectFlipyOferta(input: {
  agencySlug: string;
  storeSlug: string;
  orderId?: string | null;
  envioId: string;
  ofertaId: string;
  motivo?: string | null;
}): Promise<ActionResult<RejectFlipyOfertaResult> & { errorCode?: string }> {
  try {
    if (getIntegrationRuntimeMode() !== "live") {
      throw new ValidationError("Rechazar ofertas Flipy requiere INTEGRATION_MODE=live.");
    }
    await requireUser();
    const membership = await requireStoreAccess(input.agencySlug, input.storeSlug);
    assertCanManageOrders(can(membership.roles, "orders.manage"));
    if (!membership.storeId) throw new ValidationError("Tienda inválida.");

    const envioId = input.envioId.trim();
    const ofertaId = input.ofertaId.trim();
    if (!envioId || !ofertaId) {
      throw new ValidationError("Faltan envioId u ofertaId para rechazar la puja.");
    }

    const client = await getFlipyClientForStore(membership.agencyId, membership.storeId);
    const rejected = await client.rejectOferta(envioId, ofertaId, {
      motivo: input.motivo,
    });

    if (input.orderId) {
      revalidatePath(routes.store.orderDetail(input.agencySlug, input.storeSlug, input.orderId));
    }
    revalidatePath(routes.store.flipy(input.agencySlug, input.storeSlug));

    return actionOk({
      envioId: rejected.envioId,
      ofertaId: rejected.ofertaId,
      estado: rejected.estado,
      message: rejected.message,
      bidsRemaining: rejected.bidsRemaining,
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
