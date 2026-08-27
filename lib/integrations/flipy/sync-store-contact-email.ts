import "server-only";

import { createFlipyPartnerClient } from "@/lib/integrations/flipy/client";
import { readFlipyTiendaId } from "@/lib/integrations/flipy/credentials";
import { getFlipyEnv, isFlipyConfigured } from "@/lib/integrations/flipy/env";
import type { FlipyTiendaProfileResult } from "@/lib/integrations/flipy/partner-contract";
import { buildStorePartnerEmailTrust } from "@/lib/integrations/flipy/partner-trust";
import { readFlipyContactEmail } from "@/lib/integrations/flipy/settings";
import { resolveFlipyIntegrationForStore } from "@/lib/integrations/flipy/webhook-ingress";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Json } from "@/types/database";

/** Push CT-verified store contact email to Flipy (PATCH contact-email v0.2.1). */
export async function syncFlipyStoreContactEmailTrust(input: {
  agencyId: string;
  storeId: string;
  contactEmail: string;
  emailVerifiedAt: string;
}): Promise<FlipyTiendaProfileResult | null> {
  if (!isFlipyConfigured()) return null;

  const admin = createAdminClient();
  const integration = await resolveFlipyIntegrationForStore(admin, input.agencyId, input.storeId);
  if (!integration || integration.status === "disconnected" || integration.status === "revoked") {
    return null;
  }

  const flipyTiendaId =
    readFlipyTiendaId(integration.settings) ?? integration.external_account_id?.trim() ?? null;
  if (!flipyTiendaId) return null;

  const trust = buildStorePartnerEmailTrust({
    externalStoreId: input.storeId,
    email: input.contactEmail,
    emailVerifiedAt: input.emailVerifiedAt,
  });
  if (!trust) return null;

  const env = getFlipyEnv();
  const partnerKey = env.partnerApiKey;
  if (!partnerKey) return null;

  const flipyClient = createFlipyPartnerClient({
    baseUrl: env.apiBaseUrl,
    partnerKey,
    partnerId: env.partnerId,
    externalStoreId: input.storeId,
  });

  const profile = await flipyClient.patchTiendaContactEmail(flipyTiendaId, {
    contactEmail: input.contactEmail,
    emailVerifiedAt: trust.emailVerifiedAt,
    partnerEmailAssertion: trust.partnerEmailAssertion,
  });

  const normalizedEmail = input.contactEmail.trim().toLowerCase();
  const currentIntegrationEmail = readFlipyContactEmail(integration.settings)?.trim().toLowerCase();
  if (currentIntegrationEmail !== normalizedEmail) {
    const base =
      integration.settings && typeof integration.settings === "object" && !Array.isArray(integration.settings)
        ? (integration.settings as Record<string, unknown>)
        : {};
    await admin
      .from("integrations")
      .update({
        settings: { ...base, email: normalizedEmail } as Json,
        updated_at: new Date().toISOString(),
      })
      .eq("id", integration.id)
      .eq("agency_id", input.agencyId)
      .eq("store_id", input.storeId);
  }

  return profile;
}
