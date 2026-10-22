import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";
import { evaluateSubscriptionAccess } from "@/lib/billing/access-policy";
import {
  evaluateMonthlyOrderUsage,
  lockedStoreNavHrefs,
  planUpgradeMessage,
  resolvePlanEntitlements,
  storePathPlanSection,
} from "@/lib/billing/entitlements";

// Mirrors supabase/migrations/20261022140000_plans_features_no_free.sql.
const STARTER = {
  reconciliation: false,
  whatsapp: false,
  automations: false,
  conversions: false,
  api: false,
  white_label: false,
};
const GROWTH = { ...STARTER, reconciliation: true, whatsapp: true, automations: true };
const SCALE = { ...GROWTH, conversions: true, api: true, white_label: true };

function paid(planCode: string, features: Record<string, unknown>) {
  return resolvePlanEntitlements({ planCode, planName: planCode, features, accessAllowed: true });
}

describe("plan entitlements (no free plan)", () => {
  it("without a plan nothing in the console is unlocked", () => {
    const none = resolvePlanEntitlements(null);
    assert.equal(none.tier, "none");
    assert.equal(Object.values(none.sections).some(Boolean), false);
  });

  it("a blocked subscription behaves like no plan", () => {
    const blocked = resolvePlanEntitlements({
      planCode: "scale",
      planName: "Scale",
      features: SCALE,
      accessAllowed: false,
    });
    assert.equal(blocked.tier, "none");
    assert.equal(blocked.sections.console, false);
  });

  it("starter, growth and scale unlock their sections", () => {
    assert.deepEqual(paid("starter", STARTER).sections, {
      console: true,
      reconciliation: false,
      whatsapp: false,
      automations: false,
      conversions: false,
      api: false,
    });
    assert.deepEqual(paid("growth", GROWTH).sections, {
      console: true,
      reconciliation: true,
      whatsapp: true,
      automations: true,
      conversions: false,
      api: false,
    });
    assert.deepEqual(paid("scale", SCALE).sections, {
      console: true,
      reconciliation: true,
      whatsapp: true,
      automations: true,
      conversions: true,
      api: true,
    });
  });

  it("maps store paths to sections and keeps setup pages open", () => {
    for (const path of ["", "/dashboard", "/orders/1", "/flipy", "/logistics", "/attribution", "/rto/products"]) {
      assert.equal(storePathPlanSection(path), "console", path);
    }
    assert.equal(storePathPlanSection("/reconciliation/import"), "reconciliation");
    assert.equal(storePathPlanSection("/whatsapp/templates"), "whatsapp");
    assert.equal(storePathPlanSection("/automations/new"), "automations");
    assert.equal(storePathPlanSection("/integrations"), null);
    assert.equal(storePathPlanSection("/settings"), null);
    assert.equal(storePathPlanSection("/rtox"), null);
  });

  it("locks nav items the plan does not unlock", () => {
    const hrefs = ["", "/orders", "/reconciliation", "/whatsapp", "/integrations", "/settings"];
    assert.deepEqual(lockedStoreNavHrefs(resolvePlanEntitlements(null), hrefs), [
      "",
      "/orders",
      "/reconciliation",
      "/whatsapp",
    ]);
    assert.deepEqual(lockedStoreNavHrefs(paid("starter", STARTER), hrefs), [
      "/reconciliation",
      "/whatsapp",
    ]);
    assert.deepEqual(lockedStoreNavHrefs(paid("growth", GROWTH), hrefs), []);
  });

  it("names the cheapest plan in upgrade messages", () => {
    assert.match(planUpgradeMessage("console"), /Elige un plan/);
    assert.match(planUpgradeMessage("reconciliation"), /Growth/);
    assert.match(planUpgradeMessage("whatsapp"), /Growth/);
    assert.match(planUpgradeMessage("conversions"), /Scale/);
    assert.match(planUpgradeMessage("api"), /Scale/);
  });

  it("warns past the monthly order limit only on paid plans", () => {
    assert.deepEqual(
      evaluateMonthlyOrderUsage({ entitlements: paid("starter", STARTER), orderLimit: 300, used: 301 }),
      { used: 301, limit: 300, overLimit: true },
    );
    assert.equal(
      evaluateMonthlyOrderUsage({ entitlements: paid("starter", STARTER), orderLimit: 300, used: 300 })
        .overLimit,
      false,
    );
    assert.deepEqual(
      evaluateMonthlyOrderUsage({ entitlements: resolvePlanEntitlements(null), orderLimit: 300, used: 900 }),
      { used: 900, limit: null, overLimit: false },
    );
  });

  it("matches the plan features migration", () => {
    const sql = readFileSync(
      resolve(process.cwd(), "supabase/migrations/20261022140000_plans_features_no_free.sql"),
      "utf8",
    );
    for (const [code, features] of [
      ["starter", STARTER],
      ["growth", GROWTH],
      ["scale", SCALE],
    ] as const) {
      assert.match(sql, new RegExp(`'${JSON.stringify(features)}'::jsonb[\\s\\S]*?where code = '${code}'`));
    }
  });
});

describe("payment messages by billing provider", () => {
  const now = new Date("2026-10-21T12:00:00.000Z");
  const pastDue = {
    subscriptionStatus: "past_due",
    gracePeriodEndsAt: null,
    currentPeriodEnd: null,
    pastDueSince: "2026-10-01T00:00:00.000Z",
  };

  it("sends Shopify plans to the Shopify admin", () => {
    const result = evaluateSubscriptionAccess({ ...pastDue, billingProvider: "shopify" }, now);
    assert.equal(result.allowed, false);
    assert.match(result.message ?? "", /Shopify/);
    assert.doesNotMatch(result.message ?? "", /método de pago en Facturación/);
  });

  it("keeps the Stripe wording for Stripe plans", () => {
    const result = evaluateSubscriptionAccess({ ...pastDue, billingProvider: "stripe" }, now);
    assert.match(result.message ?? "", /método de pago en Facturación/);
  });
});

describe("console sections are gated by plan", () => {
  const ROOT = process.cwd();
  const STORE = "app/a/[agencySlug]/s/[storeSlug]";

  it("wraps every store section in PlanGate", () => {
    const sections: Array<[string, string]> = [
      [`${STORE}/dashboard/layout.tsx`, "console"],
      [`${STORE}/orders/layout.tsx`, "console"],
      [`${STORE}/flipy/layout.tsx`, "console"],
      [`${STORE}/operations/layout.tsx`, "console"],
      [`${STORE}/attribution/layout.tsx`, "console"],
      [`${STORE}/campaigns/layout.tsx`, "console"],
      [`${STORE}/ads/layout.tsx`, "console"],
      [`${STORE}/rto/layout.tsx`, "console"],
      [`${STORE}/logistics/layout.tsx`, "console"],
      [`${STORE}/alerts/layout.tsx`, "console"],
      [`${STORE}/reconciliation/layout.tsx`, "reconciliation"],
      [`${STORE}/whatsapp/layout.tsx`, "whatsapp"],
      [`${STORE}/automations/layout.tsx`, "automations"],
      ["app/a/[agencySlug]/(agency)/api-keys/layout.tsx", "api"],
    ];
    for (const [file, section] of sections) {
      assert.equal(existsSync(resolve(ROOT, file)), true, file);
      const source = readFileSync(resolve(ROOT, file), "utf8");
      assert.match(source, new RegExp(`section="${section}"`), file);
    }
  });

  it("checks the plan in every store server action", () => {
    const actions: Array<[string, string]> = [
      ["app/actions/orders.ts", "console"],
      ["app/actions/flipy-activation.ts", "console"],
      ["app/actions/flipy-inbox.ts", "console"],
      ["app/actions/flipy-settings.ts", "console"],
      ["app/actions/flipy-settlement.ts", "console"],
      ["app/actions/flipy-shipments.ts", "console"],
      ["app/actions/flipy-wallet.ts", "console"],
      ["app/actions/flipy-widgets.ts", "console"],
      ["app/actions/attribution.ts", "console"],
      ["app/actions/alerts.ts", "console"],
      ["app/actions/shipments.ts", "console"],
      ["app/actions/reconciliation.ts", "reconciliation"],
      ["app/actions/whatsapp.ts", "whatsapp"],
      ["app/actions/automations.ts", "automations"],
      ["app/actions/conversions.ts", "conversions"],
      ["app/actions/api-keys.ts", "api"],
    ];
    for (const [file, section] of actions) {
      const source = readFileSync(resolve(ROOT, file), "utf8");
      const memberships = source.match(/const membership = await require(Store|Agency)Access\(/g) ?? [];
      const checks =
        source.match(new RegExp(`assertPlanSection\\(membership\\.agencyId, "${section}"\\)`, "g")) ?? [];
      assert.equal(memberships.length > 0, true, file);
      assert.equal(checks.length, memberships.length, file);
    }
  });

  it("keeps connecting Shopify open without a plan", () => {
    assert.doesNotMatch(
      readFileSync(resolve(ROOT, "app/actions/integrations.ts"), "utf8"),
      /assertPlanSection/,
    );
  });

  it("only sends conversions on plans with the conversions feature", () => {
    const source = readFileSync(resolve(ROOT, "lib/conversions/record-purchase-conversion.ts"), "utf8");
    assert.match(source, /entitlements\.sections\.conversions/);
    assert.equal((source.match(/await planSendsConversions\(/g) ?? []).length, 2);
  });

  it("hides embed orders until a plan is active", () => {
    const home = readFileSync(resolve(ROOT, "lib/integrations/shopify/embed-home.ts"), "utf8");
    assert.match(home, /planRequired \? \[\]/);
  });
});
