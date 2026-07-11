/**
 * Automation run orchestrator: match rules, cooldown, idempotency, execute.
 */

import { createHash } from "node:crypto";
import {
  evaluateConditions,
  isLoopTrigger,
  type TriggerContext,
} from "@/lib/automations/evaluate";
import {
  actionResultsToJson,
  executeAutomationActions,
  type ActionResultEntry,
} from "@/lib/automations/execute";
import {
  automationActionsSchema,
  automationConditionsSchema,
  type AutomationTrigger,
} from "@/lib/automations/schema";
import type { Json } from "@/types/database.generated";
import type { JobsAdminClient } from "@/lib/jobs/types";

export type RuleRow = {
  id: string;
  agency_id: string;
  store_id: string | null;
  name: string;
  trigger_type: string;
  conditions: Json;
  actions: Json;
  cooldown_minutes: number;
  is_active: boolean;
  requires_manual_approval?: boolean | null;
  priority?: number | null;
  last_triggered_at?: string | null;
};

export type RunAutomationInput = {
  admin: JobsAdminClient;
  trigger: AutomationTrigger;
  agencyId: string;
  storeId: string;
  ctx: TriggerContext;
  entityType: string;
  entityId: string;
  dryRun?: boolean;
  actorId?: string | null;
};

function idempotencyKey(ruleId: string, trigger: string, entityId: string): string {
  return createHash("sha256").update(`${ruleId}:${trigger}:${entityId}`).digest("hex").slice(0, 40);
}

export async function runAutomationsForTrigger(input: RunAutomationInput): Promise<{
  runs: Array<{ ruleId: string; runId?: string; status: string; results: ActionResultEntry[] }>;
}> {
  if (isLoopTrigger(input.ctx)) {
    return { runs: [{ ruleId: "*", status: "skipped_loop", results: [] }] };
  }

  const rulesRes = await input.admin
    .from("automation_rules")
    .select("*")
    .eq("agency_id", input.agencyId)
    .eq("store_id", input.storeId)
    .eq("trigger_type", input.trigger)
    .eq("is_active", true)
    .order("priority", { ascending: true });

  const rules = (rulesRes.data ?? []) as RuleRow[];
  const out: Array<{ ruleId: string; runId?: string; status: string; results: ActionResultEntry[] }> =
    [];

  for (const rule of rules) {
    const conditions = automationConditionsSchema.safeParse(rule.conditions);
    const actions = automationActionsSchema.safeParse(rule.actions);
    if (!conditions.success || !actions.success) {
      out.push({ ruleId: rule.id, status: "invalid_rule", results: [] });
      continue;
    }

    if (!evaluateConditions(conditions.data, input.ctx)) {
      out.push({ ruleId: rule.id, status: "conditions_not_met", results: [] });
      continue;
    }

    // Cooldown
    if (rule.cooldown_minutes > 0 && rule.last_triggered_at) {
      const elapsed =
        Date.now() - Date.parse(rule.last_triggered_at);
      if (elapsed < rule.cooldown_minutes * 60_000) {
        out.push({ ruleId: rule.id, status: "cooldown", results: [] });
        continue;
      }
    }

    const key = idempotencyKey(rule.id, input.trigger, input.entityId);
    if (!input.dryRun) {
      const existing = await input.admin
        .from("automation_runs")
        .select("id, status")
        .eq("agency_id", input.agencyId)
        .eq("rule_id", rule.id)
        .eq("idempotency_key", key)
        .maybeSingle();
      if (existing.data) {
        out.push({
          ruleId: rule.id,
          runId: existing.data.id,
          status: "idempotent_skip",
          results: [],
        });
        continue;
      }
    }

    const needsApproval = Boolean(rule.requires_manual_approval);
    const now = new Date().toISOString();

    if (input.dryRun) {
      const { results, status } = await executeAutomationActions(actions.data, {
        dryRun: true,
        agencyId: input.agencyId,
        storeId: input.storeId,
        ctx: input.ctx,
        deps: {},
      });
      out.push({ ruleId: rule.id, status: `dry_run_${status}`, results });
      continue;
    }

    const runInsert = await input.admin
      .from("automation_runs")
      .insert({
        agency_id: input.agencyId,
        store_id: input.storeId,
        rule_id: rule.id,
        status: needsApproval ? "queued" : "running",
        started_at: needsApproval ? null : now,
        trigger_payload: input.ctx as Json,
        idempotency_key: key,
        entity_type: input.entityType,
        entity_id: input.entityId,
        order_id: typeof input.ctx.orderId === "string" ? input.ctx.orderId : null,
        shipment_id: typeof input.ctx.shipmentId === "string" ? input.ctx.shipmentId : null,
        approval_status: needsApproval ? "pending" : "not_required",
        action_results: [] as Json,
      })
      .select("id")
      .single();

    if (runInsert.error || !runInsert.data) {
      out.push({ ruleId: rule.id, status: "run_create_failed", results: [] });
      continue;
    }

    const runId = runInsert.data.id;

    if (needsApproval) {
      out.push({ ruleId: rule.id, runId, status: "awaiting_approval", results: [] });
      continue;
    }

    const { results, status } = await executeAutomationActions(actions.data, {
      agencyId: input.agencyId,
      storeId: input.storeId,
      ctx: input.ctx,
      deps: buildDeps(input),
    });

    await input.admin
      .from("automation_runs")
      .update({
        status,
        finished_at: new Date().toISOString(),
        action_results: actionResultsToJson(results),
        error_message: status === "failed" ? "all_actions_failed" : null,
      })
      .eq("id", runId);

    await input.admin
      .from("automation_rules")
      .update({ last_triggered_at: now })
      .eq("id", rule.id);

    out.push({ ruleId: rule.id, runId, status, results });
  }

  return { runs: out };
}

function buildDeps(input: RunAutomationInput) {
  return {
    createAlert: async (a: {
      title: string;
      severity: string;
      body?: string;
      alertType: string;
      orderId?: string | null;
      shipmentId?: string | null;
      campaignId?: string | null;
    }) => {
      const ins = await input.admin
        .from("alerts")
        .insert({
          agency_id: input.agencyId,
          store_id: input.storeId,
          title: a.title,
          body: a.body ?? null,
          type: a.alertType,
          severity: a.severity as "info" | "warning" | "critical",
          status: "open",
          order_id: a.orderId ?? null,
          shipment_id: a.shipmentId ?? null,
          campaign_id: a.campaignId ?? null,
          source_type: "automation",
          source_id: input.entityId,
          data: { trigger: input.trigger, ctx: input.ctx } as Json,
        })
        .select("id")
        .single();
      if (ins.error || !ins.data) throw new Error("alert_insert_failed");
      return { id: ins.data.id };
    },
    changeOrderStatus: async (orderId: string, toStatus: string) => {
      // Only confirmation-related / review statuses from schema subset
      if (toStatus === "manual_review") {
        const order = await input.admin
          .from("orders")
          .select("metadata")
          .eq("id", orderId)
          .eq("store_id", input.storeId)
          .single();
        const meta =
          order.data?.metadata && typeof order.data.metadata === "object"
            ? (order.data.metadata as Record<string, unknown>)
            : {};
        await input.admin
          .from("orders")
          .update({
            confirmation_status: "manual_review",
            metadata: { ...meta, needs_review: true, review_source: "automation" } as Json,
          })
          .eq("id", orderId)
          .eq("store_id", input.storeId);
        return;
      }
      await input.admin
        .from("orders")
        .update({ order_status: toStatus as never })
        .eq("id", orderId)
        .eq("store_id", input.storeId);
    },
    enqueueJob: async (jobType: string, payload: Record<string, unknown>) => {
      const { enqueueRawEventAndJob } = await import("@/lib/jobs/enqueue");
      const enqueued = await enqueueRawEventAndJob(input.admin, {
        agencyId: input.agencyId,
        storeId: input.storeId,
        provider: "custom_payment",
        eventType: jobType,
        jobType,
        idempotencyKey: `auto:${jobType}:${input.entityId}:${Date.now()}`,
        correlationId: crypto.randomUUID(),
        payload: payload as Json,
      });
      return { jobId: enqueued.jobId };
    },
    markForReview: async (entityType: string, entityId: string, reason: string) => {
      if (entityType === "shipment" || entityType === "order") {
        const table = entityType === "shipment" ? "shipments" : "orders";
        const row = await input.admin
          .from(table)
          .select("metadata")
          .eq("id", entityId)
          .eq("store_id", input.storeId)
          .maybeSingle();
        const meta =
          row.data?.metadata && typeof row.data.metadata === "object"
            ? (row.data.metadata as Record<string, unknown>)
            : {};
        await input.admin
          .from(table)
          .update({
            metadata: {
              ...meta,
              needs_review: true,
              review_reason: reason,
              review_source: "automation",
            } as Json,
          })
          .eq("id", entityId)
          .eq("store_id", input.storeId);
      }
    },
    requestCampaignPause: async (campaignId: string, reason?: string) => {
      const row = await input.admin
        .from("ad_campaigns")
        .select("metadata")
        .eq("id", campaignId)
        .eq("store_id", input.storeId)
        .maybeSingle();
      const meta =
        row.data?.metadata && typeof row.data.metadata === "object"
          ? (row.data.metadata as Record<string, unknown>)
          : {};
      await input.admin
        .from("ad_campaigns")
        .update({
          metadata: {
            ...meta,
            pause_requested: true,
            pause_reason: reason ?? "automation",
            pause_requested_at: new Date().toISOString(),
          } as Json,
          status: "paused_pending_mock",
        })
        .eq("id", campaignId)
        .eq("store_id", input.storeId);
    },
  };
}
