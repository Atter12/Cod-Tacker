"use server";

import { redirect, unstable_rethrow } from "next/navigation";
import { routes } from "@/config/routes";
import { ValidationError } from "@/lib/errors";
import { toUserMessage } from "@/lib/errors/to-user-message";
import { requireUser } from "@/lib/auth/require-user";
import { createAdminClient } from "@/lib/supabase/admin";
import { setActiveTenantPreference } from "@/lib/tenant/active-tenant-cookie";
import { getAccessState } from "@/lib/tenant/get-access-state";
import { logger } from "@/lib/observability/logger";

export type OnboardingInput = {
  agencyName: string;
  agencySlug: string;
  storeName: string;
  storeSlug: string;
  countryCode?: string;
  currencyCode?: string;
  timezone?: string;
};

export type OnboardingResult = { error?: string };

const slugPattern = /^[a-z0-9][a-z0-9-]{1,62}$/;

function normalizeSlug(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 63);
}

function validateOnboarding(input: OnboardingInput): {
  agencyName: string;
  agencySlug: string;
  storeName: string;
  storeSlug: string;
  countryCode: string;
  currencyCode: string;
  timezone: string;
} {
  const agencyName = input.agencyName.trim();
  const storeName = input.storeName.trim();
  const agencySlug = normalizeSlug(input.agencySlug || agencyName);
  const storeSlug = normalizeSlug(input.storeSlug || storeName);
  if (!agencyName) throw new ValidationError("Ingresa el nombre de la agencia.");
  if (!storeName) throw new ValidationError("Ingresa el nombre de la tienda.");
  if (!slugPattern.test(agencySlug)) throw new ValidationError("El slug de agencia no es válido.");
  if (!slugPattern.test(storeSlug)) throw new ValidationError("El slug de tienda no es válido.");
  return {
    agencyName,
    agencySlug,
    storeName,
    storeSlug,
    countryCode: (input.countryCode ?? "PE").trim().toUpperCase() || "PE",
    currencyCode: (input.currencyCode ?? "PEN").trim().toUpperCase() || "PEN",
    timezone: input.timezone?.trim() || "America/Lima",
  };
}

/**
 * Creates the first agency + store for a self-serve user.
 * Uses the service-role client only for membership bootstrap because RLS
 * requires an existing owner membership to insert agency_members (chicken/egg).
 * The caller must already be authenticated and without store access.
 */
export async function completeOnboarding(input: OnboardingInput): Promise<OnboardingResult> {
  const started = Date.now();
  try {
    const user = await requireUser();
    const access = await getAccessState();
    if (access.kind === "ready") {
      const first = access.stores[0];
      if (first) redirect(routes.store.dashboard(first.agencySlug, first.storeSlug));
    }
    if (access.kind === "pending_invite") {
      throw new ValidationError("Tu acceso está pendiente de activación por un administrador.");
    }

    const data = validateOnboarding(input);
    const admin = createAdminClient();

    const { data: agencyClash } = await admin.from("agencies").select("id").eq("slug", data.agencySlug).maybeSingle();
    if (agencyClash) throw new ValidationError("Ese slug de agencia ya está en uso. Elige otro.");

    const { data: agency, error: agencyError } = await admin
      .from("agencies")
      .insert({
        name: data.agencyName,
        slug: data.agencySlug,
        country_code: data.countryCode,
        currency_code: data.currencyCode,
        timezone: data.timezone,
        created_by: user.id,
        settings: {},
        is_active: true,
        is_white_label_enabled: false,
      })
      .select("id, slug")
      .single();
    if (agencyError || !agency) {
      if (agencyError?.code === "23505") throw new ValidationError("Ese slug de agencia ya está en uso.");
      throw new ValidationError(agencyError?.message ?? "No se pudo crear la agencia.");
    }

    const { error: agencyMemberError } = await admin.from("agency_members").insert({
      agency_id: agency.id,
      user_id: user.id,
      role: "owner",
      status: "active",
      joined_at: new Date().toISOString(),
    });
    if (agencyMemberError) {
      await admin.from("agencies").delete().eq("id", agency.id);
      throw new ValidationError(agencyMemberError.message);
    }

    const { data: store, error: storeError } = await admin
      .from("stores")
      .insert({
        agency_id: agency.id,
        name: data.storeName,
        slug: data.storeSlug,
        country_code: data.countryCode,
        currency_code: data.currencyCode,
        timezone: data.timezone,
        created_by: user.id,
        settings: {},
        is_active: true,
        attribution_window_days: 7,
      })
      .select("id, slug")
      .single();
    if (storeError || !store) {
      await admin.from("agencies").delete().eq("id", agency.id);
      if (storeError?.code === "23505") throw new ValidationError("Ese slug de tienda ya está en uso en la agencia.");
      throw new ValidationError(storeError?.message ?? "No se pudo crear la tienda.");
    }

    // Owner/admin/manager access all agency stores via agency_members — no store_members row required.

    // Demo trial subscription on Starter plan (mock billing).
    const { data: starterPlan } = await admin
      .from("plans")
      .select("id")
      .eq("code", "starter")
      .maybeSingle();
    if (starterPlan) {
      const trialEnd = new Date(Date.now() + 14 * 86400000);
      await admin.from("subscriptions").insert({
        agency_id: agency.id,
        plan_id: starterPlan.id,
        status: "trialing",
        billing_provider: "demo",
        trial_ends_at: trialEnd.toISOString(),
        current_period_start: new Date().toISOString(),
        current_period_end: trialEnd.toISOString(),
        cancel_at_period_end: false,
        metadata: { demo: true, source: "onboarding" },
      });
      await admin.from("white_label_settings").upsert({
        agency_id: agency.id,
        product_name: "CODTracked",
        primary_color: "#0F766E",
        secondary_color: "#134E4A",
        hide_codtracked_branding: false,
        metadata: { schema_version: 1 },
      });
    }

    const { writeAuditLog } = await import("@/lib/audit/write-audit");
    await writeAuditLog({
      action: "agency_created",
      entityType: "agency",
      entityId: agency.id,
      actorId: user.id,
      agencyId: agency.id,
      newData: { slug: agency.slug },
      useAdmin: true,
    });
    await writeAuditLog({
      action: "store_created",
      entityType: "store",
      entityId: store.id,
      actorId: user.id,
      agencyId: agency.id,
      storeId: store.id,
      newData: { slug: store.slug },
      useAdmin: true,
    });

    await setActiveTenantPreference(agency.slug, store.slug);
    logger.info("onboarding.completed", {
      user_id: user.id,
      agency_id: agency.id,
      store_id: store.id,
      duration_ms: Date.now() - started,
    });

    redirect(routes.store.dashboard(agency.slug, store.slug));
  } catch (error) {
    unstable_rethrow(error);
    return { error: toUserMessage(error) };
  }
}

export async function suggestSlug(name: string): Promise<string> {
  return normalizeSlug(name);
}
