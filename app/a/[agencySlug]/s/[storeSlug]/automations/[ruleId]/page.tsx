import Link from "next/link";
import { AutomationDetailActions } from "@/components/automations/AutomationDetailActions";
import { CollapsibleJson } from "@/components/admin/CollapsibleJson";
import { ErrorState, SectionHeader, StatusBadge } from "@/components/ui";
import { routes } from "@/config/routes";
import { labelTrigger } from "@/lib/alerts/labels";
import { can } from "@/lib/permissions/can";
import { createClient } from "@/lib/supabase/server";
import { requireStoreAccess } from "@/lib/tenant/require-store-access";
import { getAutomationRuleById } from "@/services/automations.service";

export default async function AutomationDetailPage({
  params,
}: {
  params: Promise<{ agencySlug: string; storeSlug: string; ruleId: string }>;
}) {
  const p = await params;
  const member = await requireStoreAccess(p.agencySlug, p.storeSlug);
  if (!can(member.roles, "automations.view") || !member.storeId) {
    return <ErrorState title="Sin permiso" description="No puedes ver esta regla." />;
  }
  const rule = await getAutomationRuleById(await createClient(), member.storeId, p.ruleId);
  if (!rule) {
    return <ErrorState title="No encontrada" description="Regla inexistente." />;
  }
  const canManage = can(member.roles, "automations.manage");

  return (
    <section className="space-y-5">
      <SectionHeader
        title={rule.name}
        description={labelTrigger(rule.trigger_type)}
        action={
          <div className="flex flex-wrap gap-2 text-sm">
            <Link
              className="underline text-brand-primary"
              href={routes.store.automationRuns(p.agencySlug, p.storeSlug, rule.id)}
            >
              Ejecuciones
            </Link>
            {canManage && (
              <Link
                className="underline text-brand-primary"
                href={routes.store.automationEdit(p.agencySlug, p.storeSlug, rule.id)}
              >
                Editar
              </Link>
            )}
            <Link
              className="underline text-brand-primary"
              href={routes.store.automations(p.agencySlug, p.storeSlug)}
            >
              Volver
            </Link>
          </div>
        }
      />
      <StatusBadge
        status={rule.is_active ? "active" : "paused"}
        label={rule.is_active ? "Activa" : "Inactiva"}
      />
      {rule.description && <p className="text-sm text-text-secondary">{rule.description}</p>}
      <dl className="grid gap-2 text-sm sm:grid-cols-3">
        <div>
          <dt className="text-text-secondary">Cooldownimiento</dt>
          <dd>{rule.cooldown_minutes} min</dd>
        </div>
        <div>
          <dt className="text-text-secondary">Prioridad</dt>
          <dd>{rule.priority}</dd>
        </div>
        <div>
          <dt className="text-text-secondary">Aprobación manual</dt>
          <dd>{rule.requires_manual_approval ? "Sí" : "No"}</dd>
        </div>
      </dl>
      {canManage && (
        <AutomationDetailActions
          agencySlug={p.agencySlug}
          storeSlug={p.storeSlug}
          ruleId={rule.id}
          isActive={rule.is_active}
          triggerType={rule.trigger_type}
        />
      )}
      <h3 className="text-sm font-semibold">Condiciones</h3>
      <CollapsibleJson value={rule.conditions} />
      <h3 className="text-sm font-semibold">Acciones</h3>
      <CollapsibleJson value={rule.actions} />
    </section>
  );
}
