import Link from "next/link";
import { TemplatesManager } from "@/components/whatsapp/TemplatesManager";
import { ErrorState, SectionHeader, DemoModeBadge } from "@/components/ui";
import { routes } from "@/config/routes";
import { can } from "@/lib/permissions/can";
import { createClient } from "@/lib/supabase/server";
import { requireStoreAccess } from "@/lib/tenant/require-store-access";
import { listTemplates } from "@/services/whatsapp.service";

export default async function WhatsappTemplatesPage({
  params,
}: {
  params: Promise<{ agencySlug: string; storeSlug: string }>;
}) {
  const p = await params;
  const member = await requireStoreAccess(p.agencySlug, p.storeSlug);
  if (!can(member.roles, "whatsapp.view") || !member.storeId) {
    return <ErrorState title="Sin permiso" description="No puedes ver plantillas." />;
  }
  const templates = await listTemplates(await createClient(), member.storeId);

  return (
    <section className="space-y-5">
      <DemoModeBadge />
      <SectionHeader
        title="Plantillas WhatsApp"
        description="Estados approved/rejected son mock — no hay aprobación real de Meta."
        action={
          <Link
            className="text-sm underline text-brand-primary"
            href={routes.store.whatsapp(p.agencySlug, p.storeSlug)}
          >
            Bandeja
          </Link>
        }
      />
      <TemplatesManager
        agencySlug={p.agencySlug}
        storeSlug={p.storeSlug}
        templates={templates}
        canManage={can(member.roles, "whatsapp.manage")}
      />
    </section>
  );
}
