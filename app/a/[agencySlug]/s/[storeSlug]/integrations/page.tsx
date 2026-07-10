import { IntegrationCard, SectionHeader } from "@/components/ui";
import { createClient } from "@/lib/supabase/server";
import { requireStoreAccess } from "@/lib/tenant/require-store-access";
import { listIntegrations } from "@/services/integrations.service";

const providers = [
  { name: "Shopify", description: "Pedidos y catálogo." },
  { name: "Meta", description: "Publicidad y campañas." },
  { name: "TikTok", description: "Publicidad y campañas." },
  { name: "WhatsApp", description: "Conversaciones y confirmaciones." },
  { name: "Carrier", description: "Rastreo de envíos." },
];

export default async function IntegrationsPage({ params }: { params: Promise<{ agencySlug: string; storeSlug: string }> }) {
  const p = await params;
  const member = await requireStoreAccess(p.agencySlug, p.storeSlug);
  const rows = await listIntegrations(await createClient(), member.agencyId, member.storeId);
  return (
    <section className="space-y-5">
      <SectionHeader title="Integraciones" description="Estado real de las conexiones de esta tienda." />
      <div className="grid gap-4 lg:grid-cols-2">
        {providers.map((provider) => {
          const integration = rows.find((row) => row.provider.toLowerCase() === provider.name.toLowerCase());
          return (
            <IntegrationCard
              key={provider.name}
              name={provider.name}
              description={provider.description}
              status={integration?.status ?? "No conectado"}
            />
          );
        })}
      </div>
    </section>
  );
}
