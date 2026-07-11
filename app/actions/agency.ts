"use server";

import { revalidatePath } from "next/cache";
import { routes } from "@/config/routes";
import { actionFail, type ActionResult } from "@/lib/actions/action-result";
import { requireUser } from "@/lib/auth/require-user";
import { toUserMessage } from "@/lib/errors/to-user-message";
import { ValidationError } from "@/lib/errors";
import { requirePermission } from "@/lib/permissions/require-permission";
import { createClient } from "@/lib/supabase/server";
import { requireAgencyAccess } from "@/lib/tenant/require-agency-access";

export type AgencyInput = {
  name: string;
  slug: string;
  logoUrl?: string | null;
  countryCode?: string | null;
  currencyCode?: string;
};
export type AgencyActionResult = ActionResult<{ id: string }>;
const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function validateAgency(input: AgencyInput): void {
  if (!input.name.trim()) throw new ValidationError("Ingresa el nombre de la agencia.");
  if (!slugPattern.test(input.slug)) {
    throw new ValidationError("El slug solo puede incluir minúsculas, números y guiones.");
  }
}

/**
 * @deprecated Self-serve agency creation must go through `completeOnboarding`.
 */
export async function createAgency(_input?: AgencyInput): Promise<AgencyActionResult> {
  void _input;
  return {
    error: "Usa el onboarding para crear la primera agencia. createAgency está deprecado.",
  };
}

export async function updateAgency(agencySlug: string, input: AgencyInput): Promise<AgencyActionResult> {
  try {
    validateAgency(input);
    await requireUser();
    const membership = await requireAgencyAccess(agencySlug);
    requirePermission(membership.roles, "agency.manage");
    const supabase = await createClient();
    const { error } = await supabase
      .from("agencies")
      .update({ name: input.name.trim(), logo_url: input.logoUrl ?? null })
      .eq("id", membership.agencyId);
    if (error) return { error: toUserMessage(error) };
    revalidatePath(routes.agency.stores(agencySlug));
    return {};
  } catch (error) {
    return actionFail(error);
  }
}
