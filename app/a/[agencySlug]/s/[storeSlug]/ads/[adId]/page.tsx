import Link from "next/link";
import { ErrorState, SectionHeader } from "@/components/ui";
import { routes } from "@/config/routes";
import { can } from "@/lib/permissions/can";
import { createClient } from "@/lib/supabase/server";
import { requireStoreAccess } from "@/lib/tenant/require-store-access";
import { getAdById } from "@/services/attribution.service";

export default async function AdDetailPage({
  params,
}: {
  params: Promise<{ agencySlug: string; storeSlug: string; adId: string }>;
}) {
  const p = await params;
  const member = await requireStoreAccess(p.agencySlug, p.storeSlug);
  if (!can(member.roles, "attribution.view") || !member.storeId) {
    return <ErrorState title="Sin permiso" description="No puedes ver este anuncio." />;
  }
  const ad = await getAdById(await createClient(), member.storeId, p.adId);
  if (!ad) {
    return <ErrorState title="No encontrado" description="Anuncio inexistente." />;
  }

  return (
    <section className="space-y-5">
      <SectionHeader
        title={ad.name}
        description={`External ${ad.external_ad_id} · ${ad.platform}`}
        action={
          <Link
            className="text-sm underline text-brand-primary"
            href={routes.store.campaignDetail(p.agencySlug, p.storeSlug, ad.campaign_id)}
          >
            Ir a campaña
          </Link>
        }
      />
      <dl className="grid gap-2 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-text-secondary">Estado</dt>
          <dd>{ad.status ?? "—"}</dd>
        </div>
        <div>
          <dt className="text-text-secondary">Ad set</dt>
          <dd>{ad.ad_set_id}</dd>
        </div>
        <div>
          <dt className="text-text-secondary">Destination</dt>
          <dd>{ad.destination_url ?? "—"}</dd>
        </div>
      </dl>
    </section>
  );
}
