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

const STARTER = { api: false, whatsapp: false, automations: false, white_label: false };
const GROWTH = { api: false, whatsapp: true, automations: true, white_label: false };
const SCALE = { api: true, whatsapp: true, automations: true, white_label: false };

function paid(planCode: string, features: Record<string, unknown>) {
  return resolvePlanEntitlements({ planCode, planName: planCode, features, accessAllowed: true });
}

describe("plan entitlements", () => {
  it("free (no plan) keeps only the connector", () => {
    const free = resolvePlanEntitlements(null);
    assert.equal(free.tier, "free");
    assert.deepEqual(free.sections, {
      console: false,
      whatsapp: false,
      automations: false,
      api: false,
    });
  });

  it("a blocked subscription falls back to free", () => {
    const blocked = resolvePlanEntitlements({
      planCode: "scale",
      planName: "Scale",
      features: SCALE,
      accessAllowed: false,
    });
    assert.equal(blocked.tier, "free");
    assert.equal(blocked.sections.console, false);
  });

  it("starter, growth and scale unlock their sections", () => {
    assert.deepEqual(paid("starter", STARTER).sections, {
      console: true,
      whatsapp: false,
      automations: false,
      api: false,
    });
    assert.deepEqual(paid("growth", GROWTH).sections, {
      console: true,
      whatsapp: true,
      automations: true,
      api: false,
    });
    assert.deepEqual(paid("scale", SCALE).sections, {
      console: true,
      whatsapp: true,
      automations: true,
      api: true,
    });
  });

  it("maps store paths to sections and keeps connector pages free", () => {
    assert.equal(storePathPlanSection("/attribution"), "console");
    assert.equal(storePathPlanSection("/reconciliation/import"), "console");
    assert.equal(storePathPlanSection("/whatsapp/templates"), "whatsapp");
    assert.equal(storePathPlanSection("/automations/new"), "automations");
    for (const free of ["", "/orders", "/flipy", "/integrations", "/operations", "/settings"]) {
      assert.equal(storePathPlanSection(free), null, free);
    }
    assert.equal(storePathPlanSection("/rtox"), null);
  });

  it("locks nav items the plan does not unlock", () => {
    const hrefs = ["", "/orders", "/attribution", "/whatsapp", "/automations", "/flipy"];
    assert.deepEqual(lockedStoreNavHrefs(resolvePlanEntitlements(null), hrefs), [
      "/attribution",
      "/whatsapp",
      "/automations",
    ]);
    assert.deepEqual(lockedStoreNavHrefs(paid("starter", STARTER), hrefs), [
      "/whatsapp",
      "/automations",
    ]);
    assert.deepEqual(lockedStoreNavHrefs(paid("growth", GROWTH), hrefs), []);
  });

  it("names the cheapest plan in upgrade messages", () => {
    assert.match(planUpgradeMessage("console"), /Starter/);
    assert.match(planUpgradeMessage("whatsapp"), /Growth/);
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

describe("paid sections are gated in the console", () => {
  const ROOT = process.cwd();
  const STORE = "app/a/[agencySlug]/s/[storeSlug]";

  it("wraps every paid section in PlanGate", () => {
    const sections: Array<[string, string]> = [
      [`${STORE}/attribution/layout.tsx`, "console"],
      [`${STORE}/campaigns/layout.tsx`, "console"],
      [`${STORE}/ads/layout.tsx`, "console"],
      [`${STORE}/rto/layout.tsx`, "console"],
      [`${STORE}/reconciliation/layout.tsx`, "console"],
      [`${STORE}/logistics/layout.tsx`, "console"],
      [`${STORE}/alerts/layout.tsx`, "console"],
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

  it("checks the plan in paid server actions", () => {
    const actions: Array<[string, string]> = [
      ["app/actions/attribution.ts", "console"],
      ["app/actions/reconciliation.ts", "console"],
      ["app/actions/alerts.ts", "console"],
      ["app/actions/shipments.ts", "console"],
      ["app/actions/conversions.ts", "console"],
      ["app/actions/whatsapp.ts", "whatsapp"],
      ["app/actions/automations.ts", "automations"],
      ["app/actions/api-keys.ts", "api"],
    ];
    for (const [file, section] of actions) {
      const source = readFileSync(resolve(ROOT, file), "utf8");
      const memberships = source.match(/const membership = await require(Store|Agency)Access\(/g) ?? [];
      const checks =
        source.match(new RegExp(`assertPlanSection\\(membership\\.agencyId, "${section}"\\)`, "g")) ?? [];
      assert.equal(checks.length, memberships.length, file);
    }
  });

  it("keeps the free connector actions ungated", () => {
    for (const file of ["app/actions/orders.ts", "app/actions/flipy-widgets.ts", "app/actions/integrations.ts"]) {
      assert.doesNotMatch(readFileSync(resolve(ROOT, file), "utf8"), /assertPlanSection/, file);
    }
  });
});
