import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  BILLING_PAST_DUE_GRACE_DAYS,
  assertSubscriptionAllowsAccess,
  defaultCancelGraceEndsAt,
  evaluateSubscriptionAccess,
  type SubscriptionAccessInput,
} from "@/lib/billing/access-policy";
import { mergeSubscriptionBillingMetadata } from "@/lib/billing/subscription-metadata";
import { ValidationError } from "@/lib/errors";

const base: SubscriptionAccessInput = {
  subscriptionStatus: "active",
  gracePeriodEndsAt: null,
  currentPeriodEnd: null,
  pastDueSince: null,
};

describe("billing access policy", () => {
  it("allows active and trialing", () => {
    assert.equal(evaluateSubscriptionAccess(base).allowed, true);
    assert.equal(
      evaluateSubscriptionAccess({ ...base, subscriptionStatus: "trialing" }).code,
      "ok",
    );
  });

  it("allows null subscription (soft defaults elsewhere)", () => {
    assert.equal(evaluateSubscriptionAccess(null).code, "no_subscription");
  });

  it("allows past_due inside grace from pastDueSince", () => {
    const now = new Date("2026-07-22T12:00:00.000Z");
    const pastDueSince = new Date(
      now.getTime() - 2 * 86400000,
    ).toISOString();
    const result = evaluateSubscriptionAccess(
      {
        ...base,
        subscriptionStatus: "past_due",
        pastDueSince,
      },
      now,
    );
    assert.equal(result.allowed, true);
    assert.equal(result.code, "past_due_grace");
    assert.ok(result.message);
  });

  it("blocks past_due after grace window", () => {
    const now = new Date("2026-07-22T12:00:00.000Z");
    const pastDueSince = new Date(
      now.getTime() - (BILLING_PAST_DUE_GRACE_DAYS + 1) * 86400000,
    ).toISOString();
    const result = evaluateSubscriptionAccess(
      {
        ...base,
        subscriptionStatus: "past_due",
        pastDueSince,
      },
      now,
    );
    assert.equal(result.allowed, false);
    assert.equal(result.code, "past_due_blocked");
    assert.throws(
      () =>
        assertSubscriptionAllowsAccess(
          { ...base, subscriptionStatus: "past_due", pastDueSince },
          now,
        ),
      ValidationError,
    );
  });

  it("allows cancelled inside grace and blocks after", () => {
    const now = new Date("2026-07-22T12:00:00.000Z");
    const grace = new Date(now.getTime() + 86400000).toISOString();
    assert.equal(
      evaluateSubscriptionAccess(
        {
          ...base,
          subscriptionStatus: "cancelled",
          gracePeriodEndsAt: grace,
        },
        now,
      ).code,
      "cancelled_grace",
    );
    assert.throws(
      () =>
        assertSubscriptionAllowsAccess(
          {
            ...base,
            subscriptionStatus: "cancelled",
            gracePeriodEndsAt: null,
          },
          now,
        ),
      ValidationError,
    );
  });

  it("blocks paused and expired without grace", () => {
    assert.equal(
      evaluateSubscriptionAccess({ ...base, subscriptionStatus: "paused" }).allowed,
      false,
    );
    assert.equal(
      evaluateSubscriptionAccess({ ...base, subscriptionStatus: "expired" }).allowed,
      false,
    );
  });

  it("computes default cancel grace from period end", () => {
    const end = "2026-07-01T00:00:00.000Z";
    const grace = defaultCancelGraceEndsAt(end, new Date(end));
    assert.equal(grace, "2026-07-08T00:00:00.000Z");
  });
});

describe("mergeSubscriptionBillingMetadata", () => {
  it("stamps past_due_since once and clears on active", () => {
    const nowIso = "2026-07-22T12:00:00.000Z";
    const first = mergeSubscriptionBillingMetadata({
      previous: {},
      status: "past_due",
      nowIso,
    });
    assert.equal(first.past_due_since, nowIso);

    const second = mergeSubscriptionBillingMetadata({
      previous: first,
      status: "past_due",
      nowIso: "2026-07-25T12:00:00.000Z",
    });
    assert.equal(second.past_due_since, nowIso, "must not overwrite first past_due_since");

    const recovered = mergeSubscriptionBillingMetadata({
      previous: second,
      status: "active",
      nowIso,
    });
    assert.equal(recovered.past_due_since, undefined);
  });

  it("sets grace on cancelled when missing", () => {
    const meta = mergeSubscriptionBillingMetadata({
      previous: {},
      status: "cancelled",
      currentPeriodEnd: "2026-07-01T00:00:00.000Z",
      nowIso: "2026-07-01T00:00:00.000Z",
    });
    assert.equal(meta.grace_period_ends_at, "2026-07-08T00:00:00.000Z");
  });

  it("persists billing_interval", () => {
    const meta = mergeSubscriptionBillingMetadata({
      previous: {},
      status: "active",
      billingInterval: "year",
    });
    assert.equal(meta.billing_interval, "year");
  });
});
