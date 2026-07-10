import { SectionHeader, Card, CardContent } from "@/components/ui";
import { createClient } from "@/lib/supabase/server";
import { requireAgencyAccess } from "@/lib/tenant/require-agency-access";

export default async function AgencyBrandingPage({ params }: { params: Promise<{ agencySlug: string }> }) {
  const p = await params;
  const membership = await requireAgencyAccess(p.agencySlug);
  const { data: settings } = await (await createClient())
    .from("white_label_settings")
    .select()
    .eq("agency_id", membership.agencyId)
    .maybeSingle();
  return (
    <section className="space-y-6">
      <SectionHeader title="Marca y white label" description="Personalización visual de la plataforma para esta agencia." />
      <Card>
        <CardContent>
          {settings ? (
            <dl className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <dt className="text-text-secondary">Nombre del producto</dt>
                <dd>{settings.product_name ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-text-secondary">Color primario</dt>
                <dd>{settings.primary_color ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-text-secondary">Email de soporte</dt>
                <dd>{settings.support_email ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-text-secondary">Ocultar branding CODTracked</dt>
                <dd>{settings.hide_codtracked_branding ? "Sí" : "No"}</dd>
              </div>
            </dl>
          ) : (
            <p className="text-sm text-text-secondary">No hay configuración de marca. Contacta al equipo para habilitarla.</p>
          )}
        </CardContent>
      </Card>
    </section>
  );
}
