import assert from "node:assert/strict";
import { describe, it, beforeEach } from "node:test";
import { sanitizePayloadForDisplay, payloadLooksLarge } from "@/lib/jobs/sanitize-payload";
import {
  checkMemoryRateLimit,
  resetMemoryRateLimitsForTests,
} from "@/lib/security/rate-limit";
import { can } from "@/lib/permissions/can";
import { assertSubscriptionAllowsAccess, planAllowsWhiteLabel, type PlanLimits } from "@/lib/billing/limits";
import { ValidationError } from "@/lib/errors";

describe("sanitizePayloadForDisplay", () => {
  it("redacts secret-looking keys", () => {
    const out = sanitizePayloadForDisplay({
      order_id: "o1",
      api_key: "sk-live-secret",
      nested: { access_token: "tok", ok: true },
    }) as Record<string, unknown>;
    assert.equal(out.order_id, "o1");
    assert.equal(out.api_key, "[REDACTED]");
    const nested = out.nested as Record<string, unknown>;
    assert.equal(nested.access_token, "[REDACTED]");
    assert.equal(nested.ok, true);
  });

  it("truncates oversized strings and detects large payloads", () => {
    const big = "x".repeat(9000);
    const out = sanitizePayloadForDisplay({ body: big }) as { body: string };
    assert.ok(out.body.includes("[truncated]"));
    assert.equal(payloadLooksLarge({ a: "y".repeat(3000) }), true);
    assert.equal(payloadLooksLarge({ a: "short" }), false);
  });
});

describe("memory rate limit", () => {
  beforeEach(() => resetMemoryRateLimitsForTests());

  it("allows up to limit then blocks", () => {
    const key = "test-bucket";
    assert.equal(checkMemoryRateLimit(key, { limit: 2, windowMs: 60_000 }).ok, true);
    assert.equal(checkMemoryRateLimit(key, { limit: 2, windowMs: 60_000 }).ok, true);
    const blocked = checkMemoryRateLimit(key, { limit: 2, windowMs: 60_000 });
    assert.equal(blocked.ok, false);
    if (!blocked.ok) assert.ok(blocked.retryAfterSec >= 1);
  });
});

describe("permissions can()", () => {
  it("allows owner billing.manage and blocks viewer", () => {
    assert.equal(can(["owner"], "billing.manage"), true);
    assert.equal(can(["viewer"], "billing.manage"), false);
    assert.equal(can(["viewer"], "orders.view"), true);
    assert.equal(can(["analyst"], "api_keys.manage"), false);
    assert.equal(can(["admin"], "branding.manage"), true);
  });

  it("blocks platform_admin-only actions for support role on platform.manage", () => {
    assert.equal(can(["support"], "platform.manage"), false);
    assert.equal(can(["platform_admin"], "platform.manage"), true);
  });
});

describe("plan access policy", () => {
  const base: PlanLimits = {
    planId: "1",
    planCode: "starter",
    planName: "Starter",
    storeLimit: 2,
    orderLimit: 500,
    features: { white_label: false, csv_import: true },
    subscriptionStatus: "active",
    cancelAtPeriodEnd: false,
    trialEndsAt: null,
    currentPeriodEnd: null,
    gracePeriodEndsAt: null,
  };

  it("blocks cancelled without grace", () => {
    assert.throws(
      () => assertSubscriptionAllowsAccess({ ...base, subscriptionStatus: "cancelled" }),
      ValidationError,
    );
  });

  it("allows cancelled inside grace period", () => {
    const grace = new Date(Date.now() + 86400000).toISOString();
    assert.doesNotThrow(() =>
      assertSubscriptionAllowsAccess({
        ...base,
        subscriptionStatus: "cancelled",
        gracePeriodEndsAt: grace,
      }),
    );
  });

  it("gates white-label feature", () => {
    assert.equal(planAllowsWhiteLabel(base), false);
    assert.equal(planAllowsWhiteLabel({ ...base, features: { hide_branding: true } }), true);
  });
});
