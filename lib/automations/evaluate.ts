/**
 * Deterministic condition evaluator for automation rules.
 * Supports AND/OR groups (depth ≤ 2) and leaf ops.
 */

import type { AutomationConditions, ConditionLeaf } from "@/lib/automations/schema";

export type TriggerContext = Record<string, unknown>;

function getPath(ctx: TriggerContext, field: string): unknown {
  if (!field.includes(".")) return ctx[field];
  const parts = field.split(".");
  let cur: unknown = ctx;
  for (const p of parts) {
    if (cur == null || typeof cur !== "object") return undefined;
    cur = (cur as Record<string, unknown>)[p];
  }
  return cur;
}

function evalLeaf(leaf: ConditionLeaf, ctx: TriggerContext): boolean {
  const left = getPath(ctx, leaf.field);
  const right = leaf.value;

  switch (leaf.op) {
    case "exists":
      return left !== undefined && left !== null && left !== "";
    case "eq":
      return left === right;
    case "neq":
      return left !== right;
    case "gt":
      return typeof left === "number" && typeof right === "number" && left > right;
    case "gte":
      return typeof left === "number" && typeof right === "number" && left >= right;
    case "lt":
      return typeof left === "number" && typeof right === "number" && left < right;
    case "lte":
      return typeof left === "number" && typeof right === "number" && left <= right;
    case "contains":
      return typeof left === "string" && typeof right === "string" && left.includes(right);
    case "in":
      return Array.isArray(right) && right.includes(left);
    default:
      return false;
  }
}

function isLeaf(node: unknown): node is ConditionLeaf {
  return Boolean(node && typeof node === "object" && "field" in (node as object) && "op" in (node as object));
}

export function evaluateConditions(conditions: AutomationConditions, ctx: TriggerContext): boolean {
  const results = conditions.conditions.map((node) => {
    if (isLeaf(node)) return evalLeaf(node, ctx);
    // Inner group (depth 2)
    const inner = node as { logic: "and" | "or"; conditions: ConditionLeaf[] };
    const innerResults = inner.conditions.map((leaf) => evalLeaf(leaf, ctx));
    return inner.logic === "and" ? innerResults.every(Boolean) : innerResults.some(Boolean);
  });
  return conditions.logic === "and" ? results.every(Boolean) : results.some(Boolean);
}

/** Loop protection: reject nested automation triggers originating from automation_run. */
export function isLoopTrigger(ctx: TriggerContext, depth = 0): boolean {
  if (depth > 2) return true;
  if (ctx.__automation_depth != null && Number(ctx.__automation_depth) >= 2) return true;
  if (ctx.source === "automation" && ctx.__from_automation === true) return true;
  return false;
}
