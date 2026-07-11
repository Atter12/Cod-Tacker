import { ErrorState, SectionHeader } from "@/components/ui";
import { AutomationRuleForm } from "@/components/automations/AutomationRuleForm";
import { can } from "@/lib/permissions/can";
import { createClient } from "@/lib/supabase/server";
import { requireStoreAccess } from "@/lib/tenant/require-store-access";
import { getAutomationRuleById } from "@/services/automations.service";
import type { AutomationRuleInput } from "@/lib/automations/schema";

export default async function EditAutomationPage({
  params,
}: {
  params: Promise<{ agencySlug: string; storeSlug: string; ruleId: string }>;
}) {
  const p = await params;
  const member = await requireStoreAccess(p.agencySlug, p.storeSlug);
  if (!can(member.roles, "automations.manage") || !member.storeId) {
    return <ErrorState title="Sin permiso" description="No puedes editar reglas." />;
  }
  const rule = await getAutomationRuleById(await createClient(), member.storeId, p.ruleId);
  if (!rule) {
    return <ErrorState title="No encontrada" description="Regla inexistente." />;
  }

  const initial: Partial<AutomationRuleInput> = {
    name: rule.name,
    description: rule.description ?? "",
    triggerType: rule.trigger_type as AutomationRuleInput["triggerType"],
    conditions: rule.conditions as AutomationRuleInput["conditions"],
    actions: rule.actions as AutomationRuleInput["actions"],
    cooldownMinutes: rule.cooldown_minutes,
    priority: rule.priority,
    requiresManualApproval: rule.requires_manual_approval,
    isActive: rule.is_active,
  };

  return (
    <section className="space-y-5">
      <SectionHeader title={`Editar · ${rule.name}`} />
      <AutomationRuleForm
        agencySlug={p.agencySlug}
        storeSlug={p.storeSlug}
        ruleId={rule.id}
        initial={initial}
      />
    </section>
  );
}
