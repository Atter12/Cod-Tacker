import Link from "next/link";
import {
  DataTable,
  DemoModeBadge,
  EmptyState,
  ErrorState,
  SectionHeader,
  StatusBadge,
} from "@/components/ui";
import { routes } from "@/config/routes";
import { labelConfirmationStatus } from "@/lib/orders/labels";
import {
  parseEnumParam,
  parsePaginationParams,
  parseStringParam,
  type SearchParamsRecord,
} from "@/lib/http/search-params";
import { can } from "@/lib/permissions/can";
import { createClient } from "@/lib/supabase/server";
import { requireStoreAccess } from "@/lib/tenant/require-store-access";
import { listConversationsPaginated } from "@/services/whatsapp.service";

export default async function WhatsappInboxPage({
  params,
  searchParams,
}: {
  params: Promise<{ agencySlug: string; storeSlug: string }>;
  searchParams: Promise<SearchParamsRecord>;
}) {
  const p = await params;
  const sp = await searchParams;
  const member = await requireStoreAccess(p.agencySlug, p.storeSlug);
  if (!can(member.roles, "whatsapp.view")) {
    return <ErrorState title="Sin permiso" description="No puedes ver WhatsApp." />;
  }
  if (!member.storeId) {
    return <ErrorState title="Tienda inválida" description="Tienda no resuelta." />;
  }

  const pagination = parsePaginationParams(sp, { pageSize: 25 });
  const q = parseStringParam(sp, "q");
  const confirmation = parseEnumParam(sp, "confirmation", [
    "pending",
    "confirmed",
    "rejected",
    "expired",
    "manual_review",
    "not_requested",
  ]);

  const result = await listConversationsPaginated(await createClient(), {
    storeId: member.storeId,
    page: pagination.page,
    pageSize: pagination.pageSize,
    search: q,
    confirmationStatus: confirmation,
  });

  return (
    <section className="space-y-5">
      <DemoModeBadge />
      <SectionHeader
        title="WhatsApp"
        description="Bandeja mock · sin WhatsApp Cloud API. Estados de plantilla son demostración."
        action={
          <Link
            className="text-sm underline text-brand-primary"
            href={routes.store.whatsappTemplates(p.agencySlug, p.storeSlug)}
          >
            Plantillas
          </Link>
        }
      />
      {result.rows.length === 0 ? (
        <EmptyState
          title="Sin conversaciones"
          description="Conecta WhatsApp mock en Integraciones y simula mensajes, o crea conversaciones vía jobs."
        />
      ) : (
        <DataTable
          data={result.rows}
          getRowId={(row) => row.id}
          columns={[
            {
              id: "phone",
              header: "Teléfono",
              cell: (row) => (
                <Link
                  className="underline text-brand-primary"
                  href={routes.store.whatsappConversation(p.agencySlug, p.storeSlug, row.id)}
                >
                  {row.phone}
                </Link>
              ),
            },
            {
              id: "conf",
              header: "Confirmación",
              cell: (row) => (
                <StatusBadge
                  status={row.confirmation_status}
                  label={labelConfirmationStatus(row.confirmation_status)}
                />
              ),
            },
            {
              id: "unread",
              header: "No leídos",
              cell: (row) => String(row.unread_count ?? 0),
            },
            {
              id: "preview",
              header: "Último mensaje",
              cell: (row) => row.last_message_preview ?? "—",
            },
            {
              id: "order",
              header: "Pedido",
              cell: (row) =>
                row.order_id ? (
                  <Link
                    className="underline text-brand-primary"
                    href={routes.store.orderDetail(p.agencySlug, p.storeSlug, row.order_id)}
                  >
                    {row.order_id.slice(0, 8)}
                  </Link>
                ) : (
                  "—"
                ),
            },
            {
              id: "at",
              header: "Actividad",
              cell: (row) =>
                row.last_message_at
                  ? new Date(row.last_message_at).toLocaleString("es-PE")
                  : "—",
            },
          ]}
        />
      )}
      <p className="text-sm text-text-secondary">
        Página {result.page} · {result.total} conversaciones
      </p>
    </section>
  );
}
