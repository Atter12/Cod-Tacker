import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  embedWelcomePlanHandle,
  resolveEmbedPlanState,
} from "@/lib/billing/embed-plan-state";

describe("embed plan state", () => {
  const pricing =
    "https://admin.shopify.com/store/demo/charges/codtracked/pricing_plans";

  it("shows choose-plan CTA when there is no subscription", () => {
    const state = resolveEmbedPlanState({
      subscriptionStatus: null,
      planName: null,
      planCode: null,
      pricingPlansUrl: pricing,
    });
    assert.equal(state.showPlanCta, true);
    assert.equal(state.showManagePlan, false);
    assert.equal(state.planCtaLabel, "Elegir plan");
    assert.match(state.billingNote, /factura de Shopify/);
  });

  it("shows manage plan when trialing or active", () => {
    const trial = resolveEmbedPlanState({
      subscriptionStatus: "trialing",
      planName: "Starter",
      planCode: "starter",
      pricingPlansUrl: pricing,
    });
    assert.equal(trial.showPlanCta, false);
    assert.equal(trial.showManagePlan, true);
    assert.equal(trial.statusLabel, "Prueba · Starter");

    const active = resolveEmbedPlanState({
      subscriptionStatus: "active",
      planName: "Growth",
      planCode: "growth",
      pricingPlansUrl: pricing,
    });
    assert.equal(active.showPlanCta, false);
    assert.equal(active.showManagePlan, true);
    assert.equal(active.statusLabel, "Plan Growth");
  });

  it("hides CTAs when pricing URL is unavailable", () => {
    const state = resolveEmbedPlanState({
      subscriptionStatus: null,
      planName: null,
      planCode: null,
      pricingPlansUrl: null,
    });
    assert.equal(state.showPlanCta, false);
    assert.equal(state.showManagePlan, false);
  });

  it("reads welcome plan_handle from the return URL", () => {
    assert.equal(embedWelcomePlanHandle("?shop=x&plan_handle=starter"), "starter");
    assert.equal(embedWelcomePlanHandle(new URLSearchParams("planHandle=growth")), "growth");
    assert.equal(embedWelcomePlanHandle(""), null);
  });
});
