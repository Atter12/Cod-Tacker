import { DataTable, SectionHeader } from "@/components/ui";
import { createClient } from "@/lib/supabase/server";
import { requireStoreAccess } from "@/lib/tenant/require-store-access";
import { listOrders } from "@/services/orders.service";

export default async function OrdersPage({ params }: { params: Promise<{ agencySlug: string; storeSlug: string }> }) {
  const p = await params;
  const member = await requireStoreAccess(p.agencySlug, p.storeSlug);
  const result = await listOrders(await createClient(), { storeId: member.storeId!, from: "1970-01-01", to: new Date().toISOString() });
  return (
    <section className="space-y-5">
      <SectionHeader title="Pedidos" description={`${result.total} pedido(s) encontrado(s).`} />
      <DataTable
        data={result.data}
        getRowId={(row) => row.id}
        columns={[
          { id: "pedido", header: "Pedido", cell: (row) => row.order_number ?? row.external_order_id },
          { id: "estado", header: "Estado", cell: (row) => row.order_status },
          { id: "pago", header: "Pago", cell: (row) => row.payment_status },
          { id: "total", header: "Total", cell: (row) => `${row.total_amount} ${row.currency_code}` },
        ]}
        emptyMessage="No hay pedidos para mostrar."
      />
    </section>
  );
}
