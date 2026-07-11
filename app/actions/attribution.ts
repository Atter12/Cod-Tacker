"use server";

import { revalidatePath } from "next/cache";
import { actionFail, actionOk, type ActionResult } from "@/lib/actions/action-result";
import { writeAuditLog } from "@/lib/audit/write-audit";
import { requireUser } from "@/lib/auth/require-user";
import { routes } from "@/config/routes";
import { ValidationError } from "@/lib/errors";
import { enqueueRawEventAndJob } from "@/lib/jobs/enqueue";
import type { Role } from "@/config/permissions";
import { can } from "@/lib/permissions/can";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { requireStoreAccess } from "@/lib/tenant/require-store-access";
import type { Json } from "@/types/database.generated";

export type AttributionActionResult = ActionResult<{ jobId?: string; rawEventId?: string }>;

function assertAttributionManage(roles: readonly Role[]) {
  if (!can(roles, "attribution.manage")) {
    throw new ValidationError("No tienes permiso para recalcular atribución.");
  }
}

/**
 * Enqueues mock ads hierarchy + attribution seed. Does not overwrite original
 * touchpoints when primary attributions already exist (handler skips).
 */
export async function seedMockAdsAttribution(
  agencySlug: string,
  storeSlug: string,
): Promise<AttributionActionResult> {
  try {
    const user = await requireUser();
    const membership = await requireStoreAccess(agencySlug, storeSlug);
    assertAttributionManage(membership.roles);
    if (!membership.storeId || !membership.agencyId) {
      throw new ValidationError("Tienda inválida.");
    }

    const client = await createClient();
    const integrations = await client
      .from("integrations")
      .select("id, provider")
      .eq("store_id", membership.storeId)
      .in("provider", ["meta", "tiktok"])
      .limit(1);
    const integrationId = integrations.data?.[0]?.id;
    if (!integrationId) {
      throw new ValidationError(
        "Conecta una integración Meta/TikTok mock en Integraciones antes de sembrar atribución.",
      );
    }

    const idempotencyKey = `ads-hierarchy:${membership.storeId}:${new Date().toISOString().slice(0, 10)}`;
    const admin = createAdminClient();
    const enqueued = await enqueueRawEventAndJob(admin, {
      agencyId: membership.agencyId,
      storeId: membership.storeId,
      integrationId,
      provider: integrations.data![0]!.provider,
      eventType: "ads.hierarchy.seeded.mock",
      jobType: "ads.hierarchy.seeded.mock",
      idempotencyKey,
      correlationId: crypto.randomUUID(),
      externalEventId: idempotencyKey,
      payload: {
        platform: "meta",
        store_slug: storeSlug,
        demo_seed: idempotencyKey,
        day_offset: 0,
      } as Json,
    });

    await writeAuditLog({
      action: "ads_hierarchy_seed_enqueued",
      entityType: "ad_account",
      entityId: membership.storeId,
      actorId: user.id,
      agencyId: membership.agencyId,
      storeId: membership.storeId,
      newData: { jobId: enqueued.jobId, rawEventId: enqueued.rawEventId },
    });

    revalidatePath(routes.store.attribution(agencySlug, storeSlug));
    revalidatePath(routes.store.campaigns(agencySlug, storeSlug));
    revalidatePath(routes.store.rto(agencySlug, storeSlug));
    return actionOk({ jobId: enqueued.jobId, rawEventId: enqueued.rawEventId });
  } catch (error) {
    return actionFail(error);
  }
}
