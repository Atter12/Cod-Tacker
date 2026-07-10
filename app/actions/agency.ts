"use server";

import { revalidatePath } from "next/cache";
import { routes } from "@/config/routes";
import { requireUser } from "@/lib/auth/require-user";
import { toUserMessage } from "@/lib/errors/to-user-message";
import { ValidationError } from "@/lib/errors";
import { requirePermission } from "@/lib/permissions/require-permission";
import { createClient } from "@/lib/supabase/server";
import { requireAgencyAccess } from "@/lib/tenant/require-agency-access";

export type AgencyInput = { name: string; slug: string; logoUrl?: string | null; countryCode?: string | null; currencyCode?: string };
export type AgencyActionResult = { error?: string; id?: string };
const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function validateAgency(input: AgencyInput): void {
  if (!input.name.trim()) throw new ValidationError("Ingresa el nombre de la agencia.");
  if (!slugPattern.test(input.slug)) throw new ValidationError("El slug solo puede incluir minúsculas, números y guiones.");
}

export async function createAgency(input: AgencyInput): Promise<AgencyActionResult> {
  try {
    validateAgency(input);
    const user = await requireUser();
    const supabase = await createClient();
    const { data: agency, error } = await supabase
      .from("agencies")
      .insert({
        name: input.name.trim(),
        slug: input.slug,
        logo_url: input.logoUrl ?? null,
        country_code: input.countryCode ?? "PE",
        currency_code: input.currencyCode ?? "USD",
        created_by: user.id,
        settings: {},
        is_active: true,
        is_white_label_enabled: false,
      })
      .select("id")
      .single();
    if (error) return { error: error.message };
    const membership = await supabase
      .from("agency_members")
      .insert({ agency_id: agency.id, user_id: user.id, role: "owner", status: "active", invited_by: null, joined_at: new Date().toISOString() });
    if (membership.error) return { error: membership.error.message };
    revalidatePath(routes.app.selectTenant);
    return { id: agency.id };
  } catch (error) {
    return { error: toUserMessage(error) };
  }
}

export async function updateAgency(agencySlug: string, input: AgencyInput): Promise<AgencyActionResult> {
  try {
    validateAgency(input);
    const membership = await requireAgencyAccess(agencySlug);
    requirePermission(membership.roles, "agency.manage");
    const supabase = await createClient();
    const { error } = await supabase
      .from("agencies")
      .update({ name: input.name.trim(), logo_url: input.logoUrl ?? null })
      .eq("id", membership.agencyId);
    if (error) return { error: error.message };
    revalidatePath(routes.agency.stores(agencySlug));
    return {};
  } catch (error) {
    return { error: toUserMessage(error) };
  }
}
