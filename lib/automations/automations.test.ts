import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { evaluateConditions, isLoopTrigger } from "@/lib/automations/evaluate";
import { executeAutomationActions } from "@/lib/automations/execute";
import {
  automationConditionsSchema,
  automationRuleInputSchema,
} from "@/lib/automations/schema";

describe("automation conditions AND/OR", () => {
  it("evaluates AND of leaves", () => {
    const conditions = automationConditionsSchema.parse({
      logic: "and",
      conditions: [
        { field: "orderStatus", op: "eq", value: "created" },
        { field: "amount", op: "gte", value: 50 },
      ],
    });
    assert.equal(
      evaluateConditions(conditions, { orderStatus: "created", amount: 80 }),
      true,
    );
    assert.equal(
      evaluateConditions(conditions, { orderStatus: "created", amount: 10 }),
      false,
    );
  });

  it("evaluates OR and nested groups", () => {
    const conditions = automationConditionsSchema.parse({
      logic: "or",
      conditions: [
        { field: "isRto", op: "eq", value: true },
        {
          logic: "and",
          conditions: [
            { field: "severity", op: "eq", value: "critical" },
            { field: "type", op: "contains", value: "health" },
          ],
        },
      ],
    });
    assert.equal(evaluateConditions(conditions, { isRto: true }), true);
    assert.equal(
      evaluateConditions(conditions, { severity: "critical", type: "integration_health" }),
      true,
    );
    assert.equal(evaluateConditions(conditions, { severity: "info" }), false);
  });
});

describe("automation loop + dry-run", () => {
  it("detects loop triggers", () => {
    assert.equal(isLoopTrigger({ __automation_depth: 2 }), true);
    assert.equal(isLoopTrigger({ source: "automation", __from_automation: true }), true);
    assert.equal(isLoopTrigger({ orderId: "x" }), false);
  });

  it("dry-run does not call deps and marks simulated", async () => {
    let called = false;
    const { results, status } = await executeAutomationActions(
      [
        {
          type: "create_alert",
          title: "t",
          severity: "warning",
          alertType: "automation",
        },
      ],
      {
        dryRun: true,
        agencyId: "a",
        storeId: "s",
        ctx: {},
        deps: {
          createAlert: async () => {
            called = true;
            return { id: "x" };
          },
        },
      },
    );
    assert.equal(called, false);
    assert.equal(status, "succeeded");
    assert.equal(results[0]!.simulated, true);
  });

  it("partial when one action fails", async () => {
    const { status, results } = await executeAutomationActions(
      [
        {
          type: "simulate_whatsapp_message",
          body: "hola",
        },
        {
          type: "mark_for_review",
          reason: "x",
        },
      ],
      {
        agencyId: "a",
        storeId: "s",
        ctx: {},
        deps: {},
      },
    );
    assert.equal(status, "partial");
    assert.equal(results.filter((r) => r.ok).length, 1);
    assert.equal(results.filter((r) => !r.ok).length, 1);
  });
});

describe("automation rule schema", () => {
  it("rejects empty actions", () => {
    const r = automationRuleInputSchema.safeParse({
      name: "x",
      triggerType: "order.created",
      conditions: { logic: "and", conditions: [{ field: "a", op: "exists" }] },
      actions: [],
    });
    assert.equal(r.success, false);
  });
});
