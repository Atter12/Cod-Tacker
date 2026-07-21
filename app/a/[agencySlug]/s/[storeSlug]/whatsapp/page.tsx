import Link from "next/link";
import { MessageCircle } from "lucide-react";
import { BackToDashboardLink } from "@/components/layout/BackToDashboardLink";
import {
  Card,
  CardContent,
  DataTable,
  DemoModeBadge,
  EmptyState,
  ErrorState,
  PageHeader,
  StatusBadge,
} from "@/components/ui";
import { routes } from "@/config/routes";
import { isDemoIntegrationMode } from "@/lib/integrations/registry";
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

  const liveMode = !isDemoIntegrationMode();
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
    <section className="space-y-6">
      <PageHeader
        title="WhatsApp"
        description={
          liveMode
            ? "Bandeja Cloud API · mensajes y estados vía webhook de Meta."
            : "Bandeja mock · sin WhatsApp Cloud API. Estados de plantilla son demostración."
        }
        actions={
          <>
            {!liveMode ? <DemoModeBadge /> : null}
            <Link
              href={routes.store.whatsappTemplates(p.agencySlug, p.storeSlug)}
              className="inline-flex h-10 min-w-[108px] items-center justify-center rounded-[10px] border border-brand-primary px-4 text-[12.5px] font-medium text-brand-primary transition-colors hover:bg-brand-softer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              Plantillas
            </Link>
          </>
        }
      />

      {result.rows.length === 0 ? (
        <EmptyState
          icon={
            <span className="grid size-12 place-items-center rounded-full bg-brand-soft text-brand-primary">
              <MessageCircle className="size-6" aria-hidden />
            </span>
          }
          title="Sin conversaciones"
          description={
            liveMode
              ? "Conecta WhatsApp en Integraciones y registra el webhook en Meta. Los pedidos COD pueden abrir conversaciones al solicitar confirmación."
              : "Conecta WhatsApp mock en Integraciones y simula mensajes, o crea conversaciones vía jobs."
          }
          className="min-h-[280px] border-solid"
        />
      ) : (
        <Card>
          <CardContent className="space-y-4 p-0 sm:p-0">
            <div className="overflow-x-auto">
              <DataTable
                data={result.rows}
                getRowId={(row) => row.id}
                columns={[
                  {
                    id: "phone",
                    header: "Teléfono",
                    cell: (row) => (
                      <Link
                        className="font-medium text-brand-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
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
                    cell: (row) => (
                      <span className="tabular-nums text-text-primary">{row.unread_count ?? 0}</span>
                    ),
                  },
                  {
                    id: "preview",
                    header: "Último mensaje",
                    cell: (row) => (
                      <span className="line-clamp-1 max-w-[240px] text-text-secondary">
                        {row.last_message_preview ?? "—"}
                      </span>
                    ),
                  },
                  {
                    id: "order",
                    header: "Pedido",
                    cell: (row) =>
                      row.order_id ? (
                        <Link
                          className="font-medium text-brand-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
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
                    cell: (row) => (
                      <span className="whitespace-nowrap text-text-secondary">
                        {row.last_message_at
                          ? new Date(row.last_message_at).toLocaleString("es-PE")
                          : "—"}
                      </span>
                    ),
                  },
                ]}
              />
            </div>
          </CardContent>
        </Card>
      )}

      <p className="text-[13px] text-text-secondary">
        Página {result.page} · {result.total} conversaciones
      </p>

      <BackToDashboardLink agencySlug={p.agencySlug} storeSlug={p.storeSlug} />
    </section>
  );
}
