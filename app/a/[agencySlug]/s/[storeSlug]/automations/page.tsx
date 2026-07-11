import Link from "next/link";
import { DataTable, EmptyState, ErrorState, SectionHeader, StatusBadge, DemoModeBadge } from "@/components/ui";
import { routes } from "@/config/routes";
import { labelTrigger } from "@/lib/alerts/labels";
import { can } from "@/lib/permissions/can";
import { createClient } from "@/lib/supabase/server";
import { requireStoreAccess } from "@/lib/tenant/require-store-access";
import { listAutomationRules } from "@/services/automations.service";

export default async function AutomationsPage({
  params,
}: {
  params: Promise<{ agencySlug: string; storeSlug: string }>;
}) {
  const p = await params;
  const member = await requireStoreAccess(p.agencySlug, p.storeSlug);
  if (!can(member.roles, "automations.view")) {
    return <ErrorState title="Sin permiso" description="No puedes ver automatizaciones." />;
  }
  if (!member.storeId) {
    return <ErrorState title="Tienda inválida" description="Tienda no resuelta." />;
  }

  const rows = await listAutomationRules(await createClient(), member.storeId);
  const canManage = can(member.roles, "automations.manage");

  return (
    <section className="space-y-5">
      <DemoModeBadge />
      <SectionHeader
        title="Automatizaciones"
        description="Reglas internas auditables. Acciones mock únicamente."
        action={
          canManage ? (
            <Link
              className="text-sm underline text-brand-primary"
              href={routes.store.automationNew(p.agencySlug, p.storeSlug)}
            >
              Nueva regla
            </Link>
          ) : null
        }
      />
      {rows.length === 0 ? (
        <EmptyState
          title="Aún no hay automatizaciones"
          description="Crea una regla con trigger, condiciones AND/OR y acciones mock."
        />
      ) : (
        <DataTable
          data={rows}
          getRowId={(row) => row.id}
          columns={[
            {
              id: "nombre",
              header: "Regla",
              cell: (row) => (
                <Link
                  className="underline text-brand-primary"
                  href={routes.store.automationDetail(p.agencySlug, p.storeSlug, row.id)}
                >
                  {row.name}
                </Link>
              ),
            },
            {
              id: "trigger",
              header: "Trigger",
              cell: (row) => labelTrigger(row.trigger_type),
            },
            {
              id: "estado",
              header: "Estado",
              cell: (row) => (
                <StatusBadge
                  status={row.is_active ? "active" : "paused"}
                  label={row.is_active ? "Activa" : "Inactiva"}
                />
              ),
            },
            {
              id: "prio",
              header: "Prioridad",
              cell: (row) => String(row.priority),
            },
            {
              id: "cd",
              header: "Cooldown",
              cell: (row) => `${row.cooldown_minutes} min`,
            },
          ]}
        />
      )}
    </section>
  );
}
