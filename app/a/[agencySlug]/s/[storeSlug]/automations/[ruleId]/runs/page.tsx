import Link from "next/link";
import { DataTable, ErrorState, SectionHeader, StatusBadge } from "@/components/ui";
import { routes } from "@/config/routes";
import { can } from "@/lib/permissions/can";
import { createClient } from "@/lib/supabase/server";
import { requireStoreAccess } from "@/lib/tenant/require-store-access";
import {
  getAutomationRuleById,
  listAutomationRuns,
} from "@/services/automations.service";

export default async function AutomationRunsPage({
  params,
}: {
  params: Promise<{ agencySlug: string; storeSlug: string; ruleId: string }>;
}) {
  const p = await params;
  const member = await requireStoreAccess(p.agencySlug, p.storeSlug);
  if (!can(member.roles, "automations.view") || !member.storeId) {
    return <ErrorState title="Sin permiso" description="No puedes ver ejecuciones." />;
  }
  const client = await createClient();
  const rule = await getAutomationRuleById(client, member.storeId, p.ruleId);
  if (!rule) {
    return <ErrorState title="No encontrada" description="Regla inexistente." />;
  }
  const runs = await listAutomationRuns(client, member.storeId, rule.id);

  return (
    <section className="space-y-5">
      <SectionHeader
        title={`Ejecuciones · ${rule.name}`}
        action={
          <Link
            className="text-sm underline text-brand-primary"
            href={routes.store.automationDetail(p.agencySlug, p.storeSlug, rule.id)}
          >
            Volver a regla
          </Link>
        }
      />
      <DataTable
        data={runs.rows}
        getRowId={(row) => row.id}
        columns={[
          {
            id: "id",
            header: "Run",
            cell: (row) => (
              <Link
                className="underline text-brand-primary"
                href={routes.store.automationRunDetail(
                  p.agencySlug,
                  p.storeSlug,
                  rule.id,
                  row.id,
                )}
              >
                {row.id.slice(0, 8)}
              </Link>
            ),
          },
          {
            id: "status",
            header: "Estado",
            cell: (row) => <StatusBadge status={row.status} />,
          },
          {
            id: "approval",
            header: "Aprobación",
            cell: (row) => row.approval_status ?? "—",
          },
          {
            id: "at",
            header: "Creada",
            cell: (row) => new Date(row.created_at).toLocaleString("es-PE"),
          },
        ]}
        emptyMessage="Sin ejecuciones aún."
      />
    </section>
  );
}
