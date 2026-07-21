import Link from "next/link";
import { ConversationActionsPanel } from "@/components/whatsapp/ConversationActionsPanel";
import {
  DataTable,
  ErrorState,
  SectionHeader,
  StatusBadge,
} from "@/components/ui";
import { routes } from "@/config/routes";
import { isDemoIntegrationMode } from "@/lib/integrations/registry";
import { labelConfirmationStatus } from "@/lib/orders/labels";
import { can } from "@/lib/permissions/can";
import { createClient } from "@/lib/supabase/server";
import { requireStoreAccess } from "@/lib/tenant/require-store-access";
import {
  getConversationById,
  listMessages,
  listTemplates,
} from "@/services/whatsapp.service";

export default async function WhatsappConversationPage({
  params,
}: {
  params: Promise<{ agencySlug: string; storeSlug: string; conversationId: string }>;
}) {
  const p = await params;
  const member = await requireStoreAccess(p.agencySlug, p.storeSlug);
  if (!can(member.roles, "whatsapp.view") || !member.storeId) {
    return <ErrorState title="Sin permiso" description="No puedes ver esta conversación." />;
  }

  const client = await createClient();
  const conv = await getConversationById(client, member.storeId, p.conversationId);
  if (!conv) {
    return <ErrorState title="No encontrada" description="Conversación inexistente." />;
  }

  const liveMode = !isDemoIntegrationMode();
  const [messages, templates] = await Promise.all([
    listMessages(client, member.storeId, conv.id),
    listTemplates(client, member.storeId),
  ]);
  const canManage = can(member.roles, "whatsapp.manage");

  // Mark read
  if (canManage && (conv.unread_count ?? 0) > 0) {
    await client
      .from("whatsapp_conversations")
      .update({ unread_count: 0 })
      .eq("id", conv.id)
      .eq("store_id", member.storeId);
  }

  return (
    <section className="space-y-5">
      <SectionHeader
        title={conv.phone}
        description={labelConfirmationStatus(conv.confirmation_status)}
        action={
          <Link
            className="text-sm underline text-brand-primary"
            href={routes.store.whatsapp(p.agencySlug, p.storeSlug)}
          >
            Bandeja
          </Link>
        }
      />
      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        <div className="space-y-3">
          <DataTable
            data={messages}
            getRowId={(m) => m.id}
            columns={[
              {
                id: "dir",
                header: "Dir",
                cell: (m) => (m.direction === "inbound" ? "←" : "→"),
              },
              { id: "body", header: "Mensaje", cell: (m) => m.body ?? "—" },
              {
                id: "status",
                header: "Estado",
                cell: (m) => <StatusBadge status={m.status} />,
              },
              {
                id: "err",
                header: "Error",
                cell: (m) => m.error_message ?? "—",
              },
              {
                id: "at",
                header: "Fecha",
                cell: (m) => new Date(m.created_at).toLocaleString("es-PE"),
              },
            ]}
            emptyMessage="Sin mensajes."
          />
        </div>
        <aside className="space-y-4">
          <div className="rounded-lg border border-border p-4 text-sm space-y-2">
            <h3 className="font-semibold">Pedido / cliente</h3>
            <p>
              Confirmación:{" "}
              <StatusBadge
                status={conv.confirmation_status}
                label={labelConfirmationStatus(conv.confirmation_status)}
              />
            </p>
            <p>
              Pedido:{" "}
              {conv.order_id ? (
                <Link
                  className="underline text-brand-primary"
                  href={routes.store.orderDetail(p.agencySlug, p.storeSlug, conv.order_id)}
                >
                  {conv.order_id.slice(0, 8)}
                </Link>
              ) : (
                "—"
              )}
            </p>
            <p>Cliente: {conv.customer_id?.slice(0, 8) ?? "—"}</p>
            {conv.closed_at && (
              <p className="text-text-secondary">
                Cerrada {new Date(conv.closed_at).toLocaleString("es-PE")}
              </p>
            )}
          </div>
          <ConversationActionsPanel
            agencySlug={p.agencySlug}
            storeSlug={p.storeSlug}
            conversationId={conv.id}
            canManage={canManage}
            liveMode={liveMode}
            templates={templates.map((t) => ({ id: t.id, name: t.name }))}
          />
        </aside>
      </div>
    </section>
  );
}
