"use server";

import { revalidatePath } from "next/cache";
import { routes } from "@/config/routes";
import { actionFail, actionOk, type ActionResult } from "@/lib/actions/action-result";
import { ValidationError } from "@/lib/errors";
import { toUserMessage } from "@/lib/errors/to-user-message";
import {
  flipyErrorUserHint,
  readFlipyErrorCode,
} from "@/lib/integrations/flipy/errors";
import {
  syncFlipySettlementsForStore,
  type FlipySettlementSyncResult,
} from "@/lib/integrations/flipy/sync-settlement";
import { can } from "@/lib/permissions/can";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireStoreAccess } from "@/lib/tenant/require-store-access";
import { requireUser } from "@/lib/auth/require-user";

export async function syncFlipySettlements(input: {
  agencySlug: string;
  storeSlug: string;
  from?: string | null;
  to?: string | null;
  days?: number;
}): Promise<ActionResult<FlipySettlementSyncResult> & { errorCode?: string }> {
  try {
    const user = await requireUser();
    const membership = await requireStoreAccess(input.agencySlug, input.storeSlug);
    if (!can(membership.roles, "reconciliation.manage") && !can(membership.roles, "integrations.manage")) {
      throw new ValidationError("No tienes permiso para sincronizar conciliación Flipy.");
    }
    if (!membership.storeId) throw new ValidationError("Tienda inválida.");

    const result = await syncFlipySettlementsForStore({
      admin: createAdminClient(),
      agencyId: membership.agencyId,
      storeId: membership.storeId,
      actorId: user.id,
      from: input.from,
      to: input.to,
      days: input.days,
    });

    revalidatePath(routes.store.reconciliation(input.agencySlug, input.storeSlug));
    revalidatePath(routes.store.integrationDetail(input.agencySlug, input.storeSlug, "flipy"));
    revalidatePath(routes.store.flipy(input.agencySlug, input.storeSlug));

    return actionOk(result);
  } catch (error) {
    const errorCode = readFlipyErrorCode(error);
    const hint = flipyErrorUserHint(errorCode);
    const message = hint ?? toUserMessage(error);
    if (errorCode) return { error: message, errorCode };
    return actionFail(error);
  }
}
