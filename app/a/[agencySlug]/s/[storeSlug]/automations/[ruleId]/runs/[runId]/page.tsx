import Link from "next/link";
import { CollapsibleJson } from "@/components/admin/CollapsibleJson";
import { ApproveRunButton } from "@/components/automations/ApproveRunButton";
import { ErrorState, SectionHeader, StatusBadge } from "@/components/ui";
import { routes } from "@/config/routes";
import { can } from "@/lib/permissions/can";
import { createClient } from "@/lib/supabase/server";
import { requireStoreAccess } from "@/lib/tenant/require-store-access";
import { getAutomationRunById } from "@/services/automations.service";

export default async function AutomationRunDetailPage({
  params,
}: {
  params: Promise<{
    agencySlug: string;
    storeSlug: string;
    ruleId: string;
    runId: string;
  }>;
}) {
  const p = await params;
  const member = await requireStoreAccess(p.agencySlug, p.storeSlug);
  if (!can(member.roles, "automations.view") || !member.storeId) {
    return <ErrorState title="Sin permiso" description="No puedes ver esta ejecución." />;
  }
  const run = await getAutomationRunById(await createClient(), member.storeId, p.runId);
  if (!run || run.rule_id !== p.ruleId) {
    return <ErrorState title="No encontrada" description="Ejecución inexistente." />;
  }
  const canManage = can(member.roles, "automations.manage");

  return (
    <section className="space-y-5">
      <SectionHeader
        title={`Run ${run.id.slice(0, 8)}`}
        description={run.error_message ?? undefined}
        action={
          <Link
            className="text-sm underline text-brand-primary"
            href={routes.store.automationRuns(p.agencySlug, p.storeSlug, p.ruleId)}
          >
            Volver
          </Link>
        }
      />
      <StatusBadge status={run.status} />
      {canManage && run.approval_status === "pending" && (
        <ApproveRunButton agencySlug={p.agencySlug} storeSlug={p.storeSlug} runId={run.id} />
      )}
      <h3 className="text-sm font-semibold">Trigger payload</h3>
      <CollapsibleJson value={run.trigger_payload} />
      <h3 className="text-sm font-semibold">Action results</h3>
      <CollapsibleJson value={run.action_results} />
    </section>
  );
}
