import { MetricCard } from "@/components/ui/MetricCard";
import { PageHeader } from "@/components/ui/PageHeader";
import { createClient } from "@/lib/supabase/server";
import { getPlatformOverviewCounts } from "@/services/admin.service";

export default async function AdminOverviewPage() {
  const counts = await getPlatformOverviewCounts(await createClient());
  const metrics = [
    ["Agencias", counts.agencies],
    ["Tiendas", counts.stores],
    ["Usuarios", counts.users],
    ["Integraciones", counts.integrations],
  ] as const;

  return (
    <div className="space-y-6">
      <PageHeader title="Resumen de plataforma" description="Vista global de los recursos disponibles para la plataforma." />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {metrics.map(([label, value]) => <MetricCard key={label} label={label} value={String(value)} hint="Total visible por RLS" />)}
      </div>
    </div>
  );
}
