/**
 * Mock automation action executor (Sprint 7).
 * All external effects are simulated; results go into action_results.
 */

import type { AutomationAction } from "@/lib/automations/schema";
import type { TriggerContext } from "@/lib/automations/evaluate";
import type { Json } from "@/types/database.generated";

export type ActionResultEntry = {
  type: string;
  ok: boolean;
  detail?: string;
  entityType?: string;
  entityId?: string;
  simulated?: boolean;
};

export type ExecuteActionsOptions = {
  dryRun?: boolean;
  agencyId: string;
  storeId: string | null;
  ctx: TriggerContext;
  /** Callbacks injected by the runner (DB / enqueue). */
  deps: {
    createAlert?: (input: {
      title: string;
      severity: string;
      body?: string;
      alertType: string;
      orderId?: string | null;
      shipmentId?: string | null;
      campaignId?: string | null;
    }) => Promise<{ id: string }>;
    changeOrderStatus?: (orderId: string, toStatus: string) => Promise<void>;
    enqueueJob?: (jobType: string, payload: Record<string, unknown>) => Promise<{ jobId: string }>;
    markForReview?: (entityType: string, entityId: string, reason: string) => Promise<void>;
    requestCampaignPause?: (campaignId: string, reason?: string) => Promise<void>;
  };
};

function str(ctx: TriggerContext, key: string): string | null {
  const v = ctx[key];
  return typeof v === "string" ? v : null;
}

export async function executeAutomationActions(
  actions: AutomationAction[],
  options: ExecuteActionsOptions,
): Promise<{ results: ActionResultEntry[]; status: "succeeded" | "partial" | "failed" }> {
  const results: ActionResultEntry[] = [];
  let okCount = 0;

  for (const action of actions) {
    try {
      if (options.dryRun) {
        results.push({
          type: action.type,
          ok: true,
          detail: "simulated_dry_run",
          simulated: true,
        });
        okCount += 1;
        continue;
      }

      switch (action.type) {
        case "create_alert": {
          if (!options.deps.createAlert) throw new Error("createAlert_unavailable");
          const created = await options.deps.createAlert({
            title: action.title,
            severity: action.severity,
            body: action.body,
            alertType: action.alertType,
            orderId: str(options.ctx, "orderId"),
            shipmentId: str(options.ctx, "shipmentId"),
            campaignId: str(options.ctx, "campaignId"),
          });
          results.push({
            type: action.type,
            ok: true,
            entityType: "alert",
            entityId: created.id,
            detail: "alert_created",
          });
          okCount += 1;
          break;
        }
        case "change_order_status": {
          const orderId = str(options.ctx, "orderId");
          if (!orderId || !options.deps.changeOrderStatus) throw new Error("order_missing");
          await options.deps.changeOrderStatus(orderId, action.toStatus);
          results.push({
            type: action.type,
            ok: true,
            entityType: "order",
            entityId: orderId,
            detail: `status=${action.toStatus}`,
          });
          okCount += 1;
          break;
        }
        case "enqueue_job": {
          if (!options.deps.enqueueJob) throw new Error("enqueue_unavailable");
          const enqueued = await options.deps.enqueueJob(action.jobType, {
            ...action.payload,
            __from_automation: true,
            __automation_depth: Number(options.ctx.__automation_depth ?? 0) + 1,
          });
          results.push({
            type: action.type,
            ok: true,
            entityType: "background_job",
            entityId: enqueued.jobId,
            detail: action.jobType,
          });
          okCount += 1;
          break;
        }
        case "simulate_whatsapp_message": {
          results.push({
            type: action.type,
            ok: true,
            detail: `mock_whatsapp:${action.body.slice(0, 80)}`,
            simulated: true,
          });
          okCount += 1;
          break;
        }
        case "simulate_outbound_webhook": {
          results.push({
            type: action.type,
            ok: true,
            detail: `mock_webhook:${action.urlLabel}`,
            simulated: true,
          });
          okCount += 1;
          break;
        }
        case "request_campaign_pause": {
          const campaignId = str(options.ctx, "campaignId");
          if (!campaignId || !options.deps.requestCampaignPause) throw new Error("campaign_missing");
          await options.deps.requestCampaignPause(campaignId, action.reason);
          results.push({
            type: action.type,
            ok: true,
            entityType: "ad_campaign",
            entityId: campaignId,
            detail: "pause_requested_mock",
            simulated: true,
          });
          okCount += 1;
          break;
        }
        case "mark_for_review": {
          const entityType = str(options.ctx, "entityType") ?? "order";
          const entityId =
            str(options.ctx, "entityId") ??
            str(options.ctx, "orderId") ??
            str(options.ctx, "shipmentId");
          if (!entityId || !options.deps.markForReview) throw new Error("entity_missing");
          await options.deps.markForReview(entityType, entityId, action.reason);
          results.push({
            type: action.type,
            ok: true,
            entityType,
            entityId,
            detail: action.reason,
          });
          okCount += 1;
          break;
        }
        default:
          results.push({ type: "unknown", ok: false, detail: "unsupported_action" });
      }
    } catch (error) {
      results.push({
        type: action.type,
        ok: false,
        detail: error instanceof Error ? error.message : "action_failed",
      });
    }
  }

  const status =
    okCount === actions.length ? "succeeded" : okCount === 0 ? "failed" : "partial";
  return { results, status };
}

export function actionResultsToJson(results: ActionResultEntry[]): Json {
  return results as unknown as Json;
}
