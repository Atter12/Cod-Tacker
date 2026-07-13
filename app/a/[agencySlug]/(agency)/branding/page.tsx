import { SectionHeader, Card, CardContent } from "@/components/ui";
import { BrandingForm } from "@/components/branding/BrandingForm";
import { BRANDING_DEFAULTS } from "@/lib/branding/schema";
import { getAgencyPlanLimits, planAllowsWhiteLabel } from "@/lib/billing/limits";
import { can } from "@/lib/permissions/can";
import { createClient } from "@/lib/supabase/server";
import { requireAgencyAccess } from "@/lib/tenant/require-agency-access";
import { getAgencyBrandingFlags, getWhiteLabelSettings } from "@/services/branding.service";

export default async function AgencyBrandingPage({
  params,
}: {
  params: Promise<{ agencySlug: string }>;
}) {
  const p = await params;
  const membership = await requireAgencyAccess(p.agencySlug);
  const client = await createClient();
  const [settings, flags, limits] = await Promise.all([
    getWhiteLabelSettings(client, membership.agencyId),
    getAgencyBrandingFlags(client, membership.agencyId),
    getAgencyPlanLimits(client, membership.agencyId),
  ]);

  const canEdit = can(membership.roles, "branding.manage");
  const whiteLabelAllowed = planAllowsWhiteLabel(limits);

  return (
    <section className="space-y-5">
      <SectionHeader
        title="Marca y white label"
        description="Personaliza cómo se ve la plataforma para tu agencia. Los cambios se aplican en la consola y en todas tus tiendas."
      />
      <Card>
        <CardContent className="p-4 sm:p-5">
          <BrandingForm
            agencySlug={p.agencySlug}
            canEdit={canEdit}
            whiteLabelAllowed={whiteLabelAllowed}
            initial={{
              productName: settings?.product_name ?? BRANDING_DEFAULTS.productName,
              primaryColor: settings?.primary_color ?? BRANDING_DEFAULTS.primaryColor,
              secondaryColor: settings?.secondary_color ?? BRANDING_DEFAULTS.secondaryColor,
              logoUrl: settings?.logo_url ?? "",
              faviconUrl: settings?.favicon_url ?? "",
              loginBackgroundUrl: settings?.login_background_url ?? "",
              supportEmail: settings?.support_email ?? "",
              supportWhatsapp: settings?.support_whatsapp ?? "",
              hideCodtrackedBranding: settings?.hide_codtracked_branding ?? false,
              isWhiteLabelEnabled: flags?.is_white_label_enabled ?? false,
            }}
          />
        </CardContent>
      </Card>
    </section>
  );
}
