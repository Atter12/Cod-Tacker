"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { routes } from "@/config/routes";
import { toUserMessage } from "@/lib/errors/to-user-message";
import { ValidationError } from "@/lib/errors";
import { requirePermission } from "@/lib/permissions/require-permission";
import { createClient } from "@/lib/supabase/server";
import { setActiveTenantPreference } from "@/lib/tenant/active-tenant-cookie";
import { requireAgencyAccess } from "@/lib/tenant/require-agency-access";
import { requireStoreAccess } from "@/lib/tenant/require-store-access";
import { writeAuditLog } from "@/lib/audit/write-audit";
import { requireUser } from "@/lib/auth/require-user";

export type StoreInput = {
  name: string;
  slug: string;
  timezone?: string;
  currencyCode?: string;
  countryCode?: string | null;
};
export type StoreActionResult = { error?: string; id?: string };
const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function validateStore(input: StoreInput): void {
  if (!input.name.trim()) throw new ValidationError("Ingresa el nombre de la tienda.");
  if (!slugPattern.test(input.slug)) throw new ValidationError("El slug solo puede incluir minúsculas, números y guiones.");
}

export async function createStore(agencySlug: string, input: StoreInput): Promise<StoreActionResult> {
  try {
    validateStore(input);
    const user = await requireUser();
    const membership = await requireAgencyAccess(agencySlug);
    requirePermission(membership.roles, "store.create");
    const supabase = await createClient();
    const { data: store, error } = await supabase
      .from("stores")
      .insert({
        agency_id: membership.agencyId,
        name: input.name.trim(),
        slug: input.slug,
        timezone: input.timezone ?? "America/Lima",
        currency_code: input.currencyCode ?? "PEN",
        country_code: input.countryCode ?? "PE",
        settings: {},
        is_active: true,
        attribution_window_days: 30,
        created_by: user.id,
      })
      .select("id, slug")
      .single();
    if (error) {
      if (error.code === "23505") return { error: "Ese slug de tienda ya está en uso en la agencia." };
      return { error: error.message };
    }

    await writeAuditLog({
      action: "store_created",
      entityType: "store",
      entityId: store.id,
      actorId: user.id,
      agencyId: membership.agencyId,
      storeId: store.id,
      newData: { slug: store.slug, name: input.name.trim() },
    });

    await setActiveTenantPreference(agencySlug, store.slug);
    revalidatePath(routes.agency.stores(agencySlug));
  } catch (error) {
    return { error: toUserMessage(error) };
  }
  redirect(routes.store.dashboard(agencySlug, input.slug));
}

export async function setActiveStore(agencySlug: string, storeSlug: string): Promise<StoreActionResult> {
  try {
    await requireStoreAccess(agencySlug, storeSlug);
    await setActiveTenantPreference(agencySlug, storeSlug);
    return {};
  } catch (error) {
    return { error: toUserMessage(error) };
  }
}
