import { BackToDashboardLink } from "@/components/layout/BackToDashboardLink";
import { StoreSettingsForm } from "@/components/settings/StoreSettingsForm";
import { Card, CardContent, PageHeader } from "@/components/ui";
import { can } from "@/lib/permissions/can";
import { createClient } from "@/lib/supabase/server";
import { requireStoreAccess } from "@/lib/tenant/require-store-access";
import { getStoreSettingsView } from "@/services/settings.service";
import type { AttributionModelValue } from "@/lib/settings/store-settings";

export default async function StoreSettingsPage({
  params,
}: {
  params: Promise<{ agencySlug: string; storeSlug: string }>;
}) {
  const p = await params;
  const member = await requireStoreAccess(p.agencySlug, p.storeSlug);
  const view = await getStoreSettingsView(await createClient(), member.storeId!);
  if (!view) {
    return (
      <section className="space-y-6">
        <PageHeader
          title="Configuración de tienda"
          description="Ajustes de operación y atribución."
        />
        <p className="text-sm text-text-secondary">No se pudo cargar la tienda.</p>
        <BackToDashboardLink agencySlug={p.agencySlug} storeSlug={p.storeSlug} />
      </section>
    );
  }

  const canEdit = can(member.roles, "store.manage");

  return (
    <section className="space-y-6">
      <PageHeader
        title="Configuración de tienda"
        description="Nombre, geografía, atribución, RTO, COD y preferencias. Cambios auditados."
      />
      <Card className="w-full">
        <CardContent>
          <StoreSettingsForm
            agencySlug={p.agencySlug}
            storeSlug={p.storeSlug}
            canEdit={canEdit}
            initial={{
              name: view.store.name,
              countryCode: view.store.country_code,
              currencyCode: view.store.currency_code,
              timezone: view.store.timezone,
              attributionModel: view.store.default_attribution_model as AttributionModelValue,
              attributionWindowDays: view.store.attribution_window_days,
              settings: view.settings,
            }}
          />
        </CardContent>
      </Card>
      <BackToDashboardLink agencySlug={p.agencySlug} storeSlug={p.storeSlug} />
    </section>
  );
}
