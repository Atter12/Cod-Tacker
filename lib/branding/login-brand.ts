import "server-only";

import {
  agencySlugFromNextPath,
  normalizeAgencySlugParam,
} from "@/lib/branding/login-brand-slug";
import {
  resolveAgencyBrandTheme,
  type AgencyBrandTheme,
} from "@/lib/branding/theme";
import { createAdminClient } from "@/lib/supabase/admin";
import { getActiveTenantPreference } from "@/lib/tenant/active-tenant-cookie";

export { agencySlugFromNextPath, normalizeAgencySlugParam } from "@/lib/branding/login-brand-slug";

/**
 * Resolve which agency branding to show on public auth screens.
 * Priority: explicit `agency` query → slug inside `next` → active-tenant cookie.
 */
export async function resolveLoginAgencySlug(input: {
  agency?: string | null;
  next?: string | null;
}): Promise<string | null> {
  const fromQuery = normalizeAgencySlugParam(input.agency);
  if (fromQuery) return fromQuery;

  const fromNext = agencySlugFromNextPath(input.next);
  if (fromNext) return fromNext;

  const preferred = await getActiveTenantPreference();
  return normalizeAgencySlugParam(preferred.agencySlug);
}

/**
 * Public-safe brand theme for login (service role; no session required).
 * Returns null when slug missing, agency unknown, or admin key unavailable.
 */
export async function getPublicLoginBrand(
  agencySlug: string | null | undefined,
): Promise<AgencyBrandTheme | null> {
  const slug = normalizeAgencySlugParam(agencySlug);
  if (!slug) return null;

  let admin;
  try {
    admin = createAdminClient();
  } catch {
    return null;
  }

  const { data: agency } = await admin
    .from("agencies")
    .select("id, is_white_label_enabled, logo_url")
    .eq("slug", slug)
    .eq("is_active", true)
    .maybeSingle();

  if (!agency) return null;

  const { data: settings } = await admin
    .from("white_label_settings")
    .select("*")
    .eq("agency_id", agency.id)
    .maybeSingle();

  return resolveAgencyBrandTheme(settings, {
    is_white_label_enabled: agency.is_white_label_enabled,
    logo_url: agency.logo_url,
  });
}
