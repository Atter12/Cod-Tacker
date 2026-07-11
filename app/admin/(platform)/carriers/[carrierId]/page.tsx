import Link from "next/link";
import { ErrorState, PageHeader, StatusBadge } from "@/components/ui";
import { DataTable } from "@/components/ui/DataTable";
import { routes } from "@/config/routes";
import { createClient } from "@/lib/supabase/server";
import {
  getCarrier,
  listCarrierConnectionsByCarrier,
  listCarrierMappings,
} from "@/services/carriers.service";

export default async function AdminCarrierDetailPage({
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
        <PageHeader title="Transportista" description={carrierId} />
        <ErrorState title="Transportista no encontrado" description="El identificador no existe." />
      </div>
    );
  }

  const [connections, mappings] = await Promise.all([
    listCarrierConnectionsByCarrier(client, carrier.id),
    listCarrierMappings(client, carrier.id),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title={carrier.name}
        description={`Código ${carrier.code} · ${carrier.is_active ? "Activo" : "Inactivo"}`}
        actions={
          <div className="flex gap-3 text-sm">
            <Link className="text-brand-primary hover:underline" href={routes.admin.carriers}>
              ← Lista
            </Link>
            <Link
              className="text-brand-primary hover:underline"
              href={routes.admin.carrierMappings(carrier.id)}
            >
              Gestionar mapeos
            </Link>
          </div>
        }
      />

      <div className="grid gap-3 rounded-lg border border-border bg-surface-elevated p-4 text-sm sm:grid-cols-3">
        <div>
          <p className="text-text-secondary">Países</p>
          <p>{carrier.country_codes?.join(", ") || "—"}</p>
        </div>
        <div>
          <p className="text-text-secondary">Webhooks / Polling</p>
          <p>
            {carrier.supports_webhooks ? "Webhooks" : "—"} /{" "}
            {carrier.supports_polling ? "Polling" : "—"}
          </p>
        </div>
        <div>
          <p className="text-text-secondary">Mapeos activos</p>
          <p>{mappings.filter((m) => m.is_active).length}</p>
        </div>
      </div>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold">Conexiones ({connections.length})</h2>
        <div className="overflow-hidden rounded-lg border border-border">
          <DataTable
            data={connections}
            getRowId={(row) => row.id}
            emptyMessage="Sin conexiones de tienda para este transportista."
            columns={[
              { id: "agency", header: "Agencia", cell: (row) => row.agency_id.slice(0, 8) },
              {
                id: "store",
                header: "Tienda",
                cell: (row) => row.store_id?.slice(0, 8) ?? "—",
              },
              {
                id: "status",
                header: "Estado",
                cell: (row) => <StatusBadge status={row.status} />,
              },
              {
                id: "poll",
                header: "Último poll",
                cell: (row) =>
                  row.last_polled_at
                    ? new Intl.DateTimeFormat("es-PE", {
                        dateStyle: "short",
                        timeStyle: "short",
                      }).format(new Date(row.last_polled_at))
                    : "—",
              },
            ]}
          />
        </div>
      </section>
    </div>
  );
}
