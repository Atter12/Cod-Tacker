import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  billingWebhookIdempotencyKey,
  classifyBillingWebhookClaim,
  isBillingWebhookUniqueViolation,
  isHandledStripeBillingEvent,
  stripeEventToBillingJobType,
} from "@/lib/integrations/stripe/webhook-idempotency";
import { mapStripeInvoiceStatus, unixToIso } from "@/lib/integrations/stripe/map-invoice";
import { mapStripeSubscriptionStatus } from "@/lib/integrations/stripe/map-subscription";
import { isSelfServePlanCode } from "@/lib/integrations/contracts/billing";
import { billingSubscriptionUpdatedPayloadSchema } from "@/lib/jobs/handlers/billing-subscription-updated";
import { billingInvoiceUpsertedPayloadSchema } from "@/lib/jobs/handlers/billing-invoice-upserted";

describe("billing stripe mappers", () => {
  it("maps stripe subscription statuses", () => {
    assert.equal(mapStripeSubscriptionStatus("active"), "active");
    assert.equal(mapStripeSubscriptionStatus("trialing"), "trialing");
    assert.equal(mapStripeSubscriptionStatus("past_due"), "past_due");
    assert.equal(mapStripeSubscriptionStatus("canceled"), "cancelled");
    assert.equal(mapStripeSubscriptionStatus("unpaid"), "expired");
    assert.equal(mapStripeSubscriptionStatus("incomplete_expired"), "expired");
    assert.equal(mapStripeSubscriptionStatus("incomplete"), "past_due");
    assert.equal(mapStripeSubscriptionStatus("paused"), "paused");
    assert.equal(mapStripeSubscriptionStatus("weird"), "past_due");
  });

  it("maps stripe invoice statuses", () => {
    assert.equal(mapStripeInvoiceStatus("paid"), "paid");
    assert.equal(mapStripeInvoiceStatus("open"), "open");
    assert.equal(mapStripeInvoiceStatus("void"), "void");
    assert.equal(mapStripeInvoiceStatus("draft"), "draft");
    assert.equal(mapStripeInvoiceStatus("uncollectible"), "uncollectible");
    assert.equal(mapStripeInvoiceStatus("unknown"), "open");
  });

  it("converts unix timestamps", () => {
    assert.equal(unixToIso(null), null);
    assert.equal(unixToIso(1_720_000_000), new Date(1_720_000_000 * 1000).toISOString());
  });

  it("marks only starter/growth/scale as self-serve", () => {
    assert.equal(isSelfServePlanCode("starter"), true);
    assert.equal(isSelfServePlanCode("growth"), true);
    assert.equal(isSelfServePlanCode("scale"), true);
    assert.equal(isSelfServePlanCode("agency"), false);
    assert.equal(isSelfServePlanCode("enterprise"), false);
  });
});

describe("stripe billing webhook idempotency helpers", () => {
  it("builds stable idempotency keys", () => {
    assert.equal(billingWebhookIdempotencyKey("evt_123"), "stripe:evt_123");
    assert.equal(billingWebhookIdempotencyKey("  evt_123  "), "stripe:evt_123");
  });

  it("classifies unique violations as duplicate claims", () => {
    assert.equal(classifyBillingWebhookClaim(null), "claimed");
    assert.equal(
      classifyBillingWebhookClaim({ code: "23505", message: "duplicate key" }),
      "duplicate",
    );
    assert.equal(
      isBillingWebhookUniqueViolation({
        message: "duplicate key value violates unique constraint",
      }),
      true,
    );
    assert.throws(() => classifyBillingWebhookClaim({ code: "42P01", message: "missing" }));
  });

  it("routes handled events to job types", () => {
    assert.equal(isHandledStripeBillingEvent("invoice.paid"), true);
    assert.equal(isHandledStripeBillingEvent("customer.created"), false);
    assert.equal(
      stripeEventToBillingJobType("customer.subscription.updated"),
      "billing.subscription.updated",
    );
    assert.equal(stripeEventToBillingJobType("invoice.payment_failed"), "billing.invoice.upserted");
    assert.equal(stripeEventToBillingJobType("ping"), null);
  });
});

describe("billing job payload schemas", () => {
  const agencyId = "00000000-0000-4000-8000-000000000010";

  it("accepts a valid subscription.updated payload", () => {
    const parsed = billingSubscriptionUpdatedPayloadSchema.safeParse({
      agencyId,
      planCode: "growth",
      status: "active",
      providerCustomerId: "cus_x",
      providerSubscriptionId: "sub_x",
      cancelAtPeriodEnd: false,
      currentPeriodStart: "2026-07-01T00:00:00.000Z",
      currentPeriodEnd: "2026-08-01T00:00:00.000Z",
      trialEndsAt: null,
      billingInterval: "month",
    });
    assert.equal(parsed.success, true);
  });

  it("rejects invalid subscription status", () => {
    const parsed = billingSubscriptionUpdatedPayloadSchema.safeParse({
      agencyId,
      planCode: "growth",
      status: "nope",
      providerCustomerId: "cus_x",
      providerSubscriptionId: "sub_x",
      cancelAtPeriodEnd: false,
      currentPeriodStart: null,
      currentPeriodEnd: null,
      trialEndsAt: null,
    });
    assert.equal(parsed.success, false);
  });

  it("accepts invoice.upserted and mark_past_due", () => {
    const parsed = billingInvoiceUpsertedPayloadSchema.safeParse({
      agencyId,
      providerInvoiceId: "in_1",
      invoiceNumber: "INV-1",
      status: "open",
      currencyCode: "USD",
      amountCents: 4900,
      periodStart: null,
      periodEnd: null,
      issuedAt: "2026-07-22T00:00:00.000Z",
      paidAt: null,
      providerSubscriptionId: "sub_x",
      hostedInvoiceUrl: null,
      invoicePdf: null,
      mark_past_due: true,
    });
    assert.equal(parsed.success, true);
  });
});
