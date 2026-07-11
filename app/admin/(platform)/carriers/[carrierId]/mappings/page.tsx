import Link from "next/link";
import { CarrierMappingsPanel } from "@/components/admin/CarrierMappingsPanel";
import { ErrorState, PageHeader } from "@/components/ui";
import { routes } from "@/config/routes";
import { createClient } from "@/lib/supabase/server";
import {
  getCarrier,
  listCarrierMappings,
  listUnmapped,
} from "@/services/carriers.service";

export default async function AdminCarrierMappingsPage({
  params,
}: {
  params: Promise<{ carrierId: string }>;
}) {
  const { carrierId } = await params;
  const client = await createClient();
  const carrier = await getCarrier(client, carrierId);
  if (!carrier) {
    return (
      <div className="space-y-6">
        <PageHeader title="Mapeos" description={carrierId} />
        <ErrorState title="Transportista no encontrado" description="El identificador no existe." />
      </div>
    );
  }

  const [mappings, unmapped] = await Promise.all([
    listCarrierMappings(client, carrier.id),
    listUnmapped(client, carrier.id),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Mapeos · ${carrier.name}`}
        description="Normalización de estados del transportista, estados sin mapear y auditoría de versiones."
        actions={
          <Link className="text-sm text-brand-primary hover:underline" href={routes.admin.carrierDetail(carrier.id)}>
            ← Detalle transportista
          </Link>
        }
      />
      <CarrierMappingsPanel carrierId={carrier.id} mappings={mappings} unmapped={unmapped} />
    </div>
  );
}
