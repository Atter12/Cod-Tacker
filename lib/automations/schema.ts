/**
 * Typed schemas for automation rules (Sprint 7).
 * Never trust arbitrary client JSON — parse with these schemas on the server.
 */

import { z } from "zod";

export const AUTOMATION_TRIGGERS = [
  "order.created",
  "order.confirmed",
  "shipment.status_changed",
  "shipment.rto",
  "campaign.rto_threshold_exceeded",
  "settlement.discrepancy",
  "integration.health_degraded",
] as const;

export type AutomationTrigger = (typeof AUTOMATION_TRIGGERS)[number];

export const AUTOMATION_ACTION_TYPES = [
  "create_alert",
  "change_order_status",
  "enqueue_job",
  "simulate_whatsapp_message",
  "simulate_outbound_webhook",
  "request_campaign_pause",
  "mark_for_review",
] as const;

export type AutomationActionType = (typeof AUTOMATION_ACTION_TYPES)[number];

export const conditionLeafSchema = z.object({
  field: z.string().min(1).max(80),
  op: z.enum(["eq", "neq", "gt", "gte", "lt", "lte", "contains", "in", "exists"]),
  value: z.unknown().optional(),
});

export type ConditionLeaf = z.infer<typeof conditionLeafSchema>;

/** Nested group depth max 2: outer group may contain leaves or inner groups of leaves only. */
const innerGroupSchema = z.object({
  logic: z.enum(["and", "or"]),
  conditions: z.array(conditionLeafSchema).min(1).max(8),
});

export const automationConditionsSchema = z.object({
  logic: z.enum(["and", "or"]),
  conditions: z.array(z.union([conditionLeafSchema, innerGroupSchema])).min(1).max(12),
});

export type AutomationConditions = z.infer<typeof automationConditionsSchema>;

export const automationActionSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("create_alert"),
    title: z.string().min(1).max(200),
    severity: z.enum(["info", "warning", "critical"]).default("warning"),
    body: z.string().max(2000).optional(),
    alertType: z.string().min(1).max(80).default("automation"),
  }),
  z.object({
    type: z.literal("change_order_status"),
    toStatus: z.enum([
      "pending_confirmation",
      "confirmed",
      "cancelled",
      "ready_to_ship",
      "manual_review",
    ]),
  }),
  z.object({
    type: z.literal("enqueue_job"),
    jobType: z.string().min(1).max(120),
    payload: z.record(z.string(), z.unknown()).default({}),
  }),
  z.object({
    type: z.literal("simulate_whatsapp_message"),
    body: z.string().min(1).max(1000),
  }),
  z.object({
    type: z.literal("simulate_outbound_webhook"),
    urlLabel: z.string().min(1).max(120).default("mock-webhook"),
  }),
  z.object({
    type: z.literal("request_campaign_pause"),
    reason: z.string().max(200).optional(),
  }),
  z.object({
    type: z.literal("mark_for_review"),
    reason: z.string().min(1).max(200).default("automation_review"),
  }),
]);

export type AutomationAction = z.infer<typeof automationActionSchema>;

export const automationActionsSchema = z.array(automationActionSchema).min(1).max(8);

export const automationRuleInputSchema = z.object({
  name: z.string().min(1).max(120),
  description: z.string().max(500).optional(),
  triggerType: z.enum(AUTOMATION_TRIGGERS),
  conditions: automationConditionsSchema,
  actions: automationActionsSchema,
  cooldownMinutes: z.number().int().min(0).max(10_080).default(0),
  priority: z.number().int().min(1).max(1000).default(100),
  requiresManualApproval: z.boolean().default(false),
  isActive: z.boolean().default(false),
});

export type AutomationRuleInput = z.infer<typeof automationRuleInputSchema>;

export const DANGEROUS_ACTIONS = new Set<AutomationActionType>([
  "change_order_status",
  "request_campaign_pause",
  "enqueue_job",
]);

export function ruleNeedsApproval(actions: AutomationAction[], flag: boolean): boolean {
  if (flag) return true;
  return actions.some((a) => DANGEROUS_ACTIONS.has(a.type));
}
