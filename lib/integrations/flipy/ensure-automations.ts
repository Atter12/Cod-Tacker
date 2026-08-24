import "server-only";

import {
  buildFlipyStaleBidAutomationRule,
  FLIPY_STALE_BID_RULE_NAME,
} from "@/lib/integrations/flipy/automation-templates";
import { automationRuleInputSchema } from "@/lib/automations/schema";
import type { JobsAdminClient } from "@/lib/jobs/types";
import type { Json } from "@/types/database.generated";

export async function ensureFlipyAutomationRules(input: {
  admin: JobsAdminClient;
  agencyId: string;
  storeId: string;
  userId?: string | null;
}): Promise<{ created: boolean; ruleId?: string }> {
  const existing = await input.admin
    .from("automation_rules")
    .select("id")
    .eq("store_id", input.storeId)
    .eq("name", FLIPY_STALE_BID_RULE_NAME)
    .maybeSingle();

  if (existing.data?.id) {
    return { created: false, ruleId: existing.data.id };
  }

  const parsed = automationRuleInputSchema.safeParse(buildFlipyStaleBidAutomationRule());
  if (!parsed.success) {
    return { created: false };
  }

  const data = parsed.data;
  const inserted = await input.admin
    .from("automation_rules")
    .insert({
      agency_id: input.agencyId,
      store_id: input.storeId,
      name: data.name,
      description: data.description ?? null,
      trigger_type: data.triggerType,
      conditions: data.conditions as Json,
      actions: data.actions as Json,
      cooldown_minutes: data.cooldownMinutes,
      priority: data.priority,
      requires_manual_approval: data.requiresManualApproval,
      is_active: data.isActive,
      created_by: input.userId ?? null,
      updated_by: input.userId ?? null,
    })
    .select("id")
    .maybeSingle();

  if (inserted.error || !inserted.data) {
    return { created: false };
  }

  return { created: true, ruleId: inserted.data.id };
}
