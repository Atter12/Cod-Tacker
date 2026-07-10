import { SectionHeader, Card, CardContent } from "@/components/ui";
import { requireStoreAccess } from "@/lib/tenant/require-store-access";

export default async function StoreSettingsPage({ params }: { params: Promise<{ agencySlug: string; storeSlug: string }> }) {
  const p = await params;
  const member = await requireStoreAccess(p.agencySlug, p.storeSlug);
  return (
    <section className="space-y-6">
      <SectionHeader title="Configuración de tienda" description="Ajustes de operación y atribución." />
      <Card>
        <CardContent>
          <p className="text-sm text-text-secondary">ID de tienda: <span className="font-mono">{member.storeId}</span></p>
          <p className="mt-2 text-sm text-text-secondary">La configuración avanzada estará disponible próximamente.</p>
        </CardContent>
      </Card>
    </section>
  );
}
