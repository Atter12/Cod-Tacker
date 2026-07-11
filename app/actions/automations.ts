"use server";

import { revalidatePath } from "next/cache";
import { actionFail, actionOk, type ActionResult } from "@/lib/actions/action-result";
import { writeAuditLog } from "@/lib/audit/write-audit";
import { requireUser } from "@/lib/auth/require-user";
import { routes } from "@/config/routes";
import { ValidationError } from "@/lib/errors";
import {
  actionResultsToJson,
  executeAutomationActions,
} from "@/lib/automations/execute";
import {
  automationActionsSchema,
  automationConditionsSchema,
  automationRuleInputSchema,
  ruleNeedsApproval,
  type AutomationRuleInput,
} from "@/lib/automations/schema";
import { runAutomationsForTrigger } from "@/lib/automations/runner";
import type { Role } from "@/config/permissions";
import { can } from "@/lib/permissions/can";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { requireStoreAccess } from "@/lib/tenant/require-store-access";
import {
  getAutomationRuleById,
  getAutomationRunById,
} from "@/services/automations.service";
import type { Json } from "@/types/database.generated";

export type AutomationActionResult = ActionResult<{
  ruleId?: string;
  runId?: string;
  simulation?: unknown;
}>;

function assertAutomationsManage(roles: readonly Role[]) {
  if (!can(roles, "automations.manage")) {
    throw new ValidationError("No tienes permiso para gestionar automatizaciones.");
  }
}

function revalidateRules(agencySlug: string, storeSlug: string, ruleId?: string) {
  revalidatePath(routes.store.automations(agencySlug, storeSlug));
  if (ruleId) {
    revalidatePath(routes.store.automationDetail(agencySlug, storeSlug, ruleId));
    revalidatePath(routes.store.automationEdit(agencySlug, storeSlug, ruleId));
    revalidatePath(routes.store.automationRuns(agencySlug, storeSlug, ruleId));
  }
}

export async function createAutomationRule(
  agencySlug: string,
  storeSlug: string,
  input: AutomationRuleInput,
): Promise<AutomationActionResult> {
  try {
    const user = await requireUser();
    const membership = await requireStoreAccess(agencySlug, storeSlug);
    assertAutomationsManage(membership.roles);
    if (!membership.storeId || !membership.agencyId) throw new ValidationError("Tienda inválida.");

    const parsed = automationRuleInputSchema.safeParse(input);
    if (!parsed.success) throw new ValidationError("Regla inválida. Revisa condiciones y acciones.");

    const data = parsed.data;
    const requiresApproval = ruleNeedsApproval(data.actions, data.requiresManualApproval);

    const client = await createClient();
    const insert = await client
      .from("automation_rules")
      .insert({
        agency_id: membership.agencyId,
        store_id: membership.storeId,
        name: data.name,
        description: data.description ?? null,
        trigger_type: data.triggerType,
        conditions: data.conditions as Json,
        actions: data.actions as Json,
        cooldown_minutes: data.cooldownMinutes,
        priority: data.priority,
        requires_manual_approval: requiresApproval,
        is_active: data.isActive,
        created_by: user.id,
      })
      .select("id")
      .single();
    if (insert.error || !insert.data) throw new ValidationError("No se pudo crear la regla.");

    await writeAuditLog({
      action: "automation_rule_created",
      entityType: "automation_rule",
      entityId: insert.data.id,
      actorId: user.id,
      agencyId: membership.agencyId,
      storeId: membership.storeId,
      newData: { name: data.name, trigger: data.triggerType },
    });

    revalidateRules(agencySlug, storeSlug, insert.data.id);
    return actionOk({ ruleId: insert.data.id });
  } catch (error) {
    return actionFail(error);
  }
}

export async function updateAutomationRule(
  agencySlug: string,
  storeSlug: string,
  ruleId: string,
  input: AutomationRuleInput,
): Promise<AutomationActionResult> {
  try {
    const user = await requireUser();
    const membership = await requireStoreAccess(agencySlug, storeSlug);
    assertAutomationsManage(membership.roles);
    if (!membership.storeId) throw new ValidationError("Tienda inválida.");

    const parsed = automationRuleInputSchema.safeParse(input);
    if (!parsed.success) throw new ValidationError("Regla inválida.");

    const data = parsed.data;
    const client = await createClient();
    const existing = await getAutomationRuleById(client, membership.storeId, ruleId);
    if (!existing) throw new ValidationError("Regla no encontrada.");

    await client
      .from("automation_rules")
      .update({
        name: data.name,
        description: data.description ?? null,
        trigger_type: data.triggerType,
        conditions: data.conditions as Json,
        actions: data.actions as Json,
        cooldown_minutes: data.cooldownMinutes,
        priority: data.priority,
        requires_manual_approval: ruleNeedsApproval(data.actions, data.requiresManualApproval),
        is_active: data.isActive,
        updated_at: new Date().toISOString(),
      })
      .eq("id", ruleId)
      .eq("store_id", membership.storeId);

    await writeAuditLog({
      action: "automation_rule_updated",
      entityType: "automation_rule",
      entityId: ruleId,
      actorId: user.id,
      agencyId: membership.agencyId,
      storeId: membership.storeId,
    });

    revalidateRules(agencySlug, storeSlug, ruleId);
    return actionOk({ ruleId });
  } catch (error) {
    return actionFail(error);
  }
}

export async function setAutomationRuleActive(
  agencySlug: string,
  storeSlug: string,
  ruleId: string,
  isActive: boolean,
): Promise<AutomationActionResult> {
  try {
    const user = await requireUser();
    const membership = await requireStoreAccess(agencySlug, storeSlug);
    assertAutomationsManage(membership.roles);
    if (!membership.storeId) throw new ValidationError("Tienda inválida.");

    const client = await createClient();
    await client
      .from("automation_rules")
      .update({ is_active: isActive, updated_at: new Date().toISOString() })
      .eq("id", ruleId)
      .eq("store_id", membership.storeId);

    await writeAuditLog({
      action: isActive ? "automation_rule_activated" : "automation_rule_deactivated",
      entityType: "automation_rule",
      entityId: ruleId,
      actorId: user.id,
      agencyId: membership.agencyId,
      storeId: membership.storeId,
    });

    revalidateRules(agencySlug, storeSlug, ruleId);
    return actionOk({ ruleId });
  } catch (error) {
    return actionFail(error);
  }
}

/** Dry-run: evaluates conditions/actions without persisting domain changes. */
export async function simulateAutomationRule(
  agencySlug: string,
  storeSlug: string,
  ruleId: string,
  sampleCtx: Record<string, unknown>,
): Promise<AutomationActionResult> {
  try {
    await requireUser();
    const membership = await requireStoreAccess(agencySlug, storeSlug);
    assertAutomationsManage(membership.roles);
    if (!membership.storeId || !membership.agencyId) throw new ValidationError("Tienda inválida.");

    const client = await createClient();
    const rule = await getAutomationRuleById(client, membership.storeId, ruleId);
    if (!rule) throw new ValidationError("Regla no encontrada.");

    const conditions = automationConditionsSchema.safeParse(rule.conditions);
    const actions = automationActionsSchema.safeParse(rule.actions);
    if (!conditions.success || !actions.success) {
      throw new ValidationError("La regla tiene schema inválido.");
    }

    const admin = createAdminClient();
    const result = await runAutomationsForTrigger({
      admin,
      trigger: rule.trigger_type as never,
      agencyId: membership.agencyId,
      storeId: membership.storeId,
      ctx: { ...sampleCtx, __simulation: true },
      entityType: "simulation",
      entityId: `sim-${ruleId}`,
      dryRun: true,
    });

    return actionOk({ ruleId, simulation: result.runs });
  } catch (error) {
    return actionFail(error);
  }
}

export async function approveAutomationRun(
  agencySlug: string,
  storeSlug: string,
  runId: string,
): Promise<AutomationActionResult> {
  try {
    const user = await requireUser();
    const membership = await requireStoreAccess(agencySlug, storeSlug);
    assertAutomationsManage(membership.roles);
    if (!membership.storeId || !membership.agencyId) throw new ValidationError("Tienda inválida.");

    const client = await createClient();
    const run = await getAutomationRunById(client, membership.storeId, runId);
    if (!run) throw new ValidationError("Ejecución no encontrada.");
    if (run.approval_status !== "pending") {
      throw new ValidationError("Esta ejecución no espera aprobación.");
    }

    const rule = await getAutomationRuleById(client, membership.storeId, run.rule_id);
    if (!rule) throw new ValidationError("Regla no encontrada.");
    const actions = automationActionsSchema.parse(rule.actions);
    const admin = createAdminClient();

    const { results, status } = await executeAutomationActions(actions, {
      agencyId: membership.agencyId,
      storeId: membership.storeId,
      ctx: (run.trigger_payload ?? {}) as Record<string, unknown>,
      deps: {
        createAlert: async (a) => {
          const ins = await admin
            .from("alerts")
            .insert({
              agency_id: membership.agencyId!,
              store_id: membership.storeId!,
              title: a.title,
              body: a.body ?? null,
              type: a.alertType,
              severity: a.severity as "info" | "warning" | "critical",
              status: "open",
              order_id: a.orderId ?? null,
              shipment_id: a.shipmentId ?? null,
              campaign_id: a.campaignId ?? null,
              source_type: "automation",
              data: {} as Json,
            })
            .select("id")
            .single();
          if (!ins.data) throw new Error("alert_failed");
          return { id: ins.data.id };
        },
      },
    });

    const now = new Date().toISOString();
    await client
      .from("automation_runs")
      .update({
        approval_status: "approved",
        approved_by: user.id,
        approved_at: now,
        status,
        started_at: now,
        finished_at: now,
        action_results: actionResultsToJson(results),
      })
      .eq("id", runId)
      .eq("store_id", membership.storeId);

    await writeAuditLog({
      action: "automation_run_approved",
      entityType: "automation_run",
      entityId: runId,
      actorId: user.id,
      agencyId: membership.agencyId,
      storeId: membership.storeId,
      newData: { status },
    });

    revalidateRules(agencySlug, storeSlug, run.rule_id);
    return actionOk({ runId, ruleId: run.rule_id });
  } catch (error) {
    return actionFail(error);
  }
}

/** Fire a mock trigger against active rules (for smoke / demo). */
export async function fireAutomationTrigger(
  agencySlug: string,
  storeSlug: string,
  trigger: string,
  ctx: Record<string, unknown>,
): Promise<AutomationActionResult> {
  try {
    const user = await requireUser();
    const membership = await requireStoreAccess(agencySlug, storeSlug);
    assertAutomationsManage(membership.roles);
    if (!membership.storeId || !membership.agencyId) throw new ValidationError("Tienda inválida.");

    const admin = createAdminClient();
    const entityId =
      (typeof ctx.orderId === "string" && ctx.orderId) ||
      (typeof ctx.shipmentId === "string" && ctx.shipmentId) ||
      crypto.randomUUID();

    const result = await runAutomationsForTrigger({
      admin,
      trigger: trigger as never,
      agencyId: membership.agencyId,
      storeId: membership.storeId,
      ctx,
      entityType: typeof ctx.entityType === "string" ? ctx.entityType : "manual",
      entityId,
      actorId: user.id,
    });

    await writeAuditLog({
      action: "automation_trigger_fired",
      entityType: "automation_rule",
      entityId: entityId,
      actorId: user.id,
      agencyId: membership.agencyId,
      storeId: membership.storeId,
      newData: { trigger, runs: result.runs.length },
    });

    revalidateRules(agencySlug, storeSlug);
    return actionOk({ simulation: result.runs });
  } catch (error) {
    return actionFail(error);
  }
}
