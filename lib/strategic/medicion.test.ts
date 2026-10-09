import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { matchUtmCampaignToAdCampaign } from "@/lib/attribution/match-campaign";
import { adsSpendSyncedPayloadSchema } from "@/lib/jobs/handlers/ads-spend-synced";
import { purchaseConversionEventId } from "@/lib/conversions/purchase-event-id";
import { decidePurchaseResend } from "@/lib/conversions/purchase-send-gate";
import { shouldFirePurchaseOnDelivered } from "@/lib/conversions/delivered-purchase-policy";
import { evaluatePurchaseRelease } from "@/lib/conversions/release-policy";
import { decideSweepAction } from "@/lib/conversions/release-sweep-policy";

const campaigns = [
  { id: "camp-meta", external_campaign_id: "120330001", name: "Verano COD", platform: "meta" },
  { id: "camp-tiktok", external_campaign_id: "tt-7788", name: "Verano COD", platform: "tiktok" },
];

/**
 * Strategic group 6 — Medición.
 * Meta and TikTok spend land on their own campaign. Purchase uses one stable
 * event id, fires only after cash is collected, and a second sweep does not send it again.
 */
describe("strategic · medición", () => {
  it("assigns Meta and TikTok spend to the campaign of that platform", () => {
    const meta = adsSpendSyncedPayloadSchema.parse({
      platform: "meta",
      external_account_id: "act_1",
      external_campaign_id: "120330001",
      campaign_name: "Verano COD",
      metric_date: "2026-10-09",
      spend: 40,
    });
    const tiktok = adsSpendSyncedPayloadSchema.parse({
      platform: "tiktok",
      external_account_id: "adv_1",
      external_campaign_id: "tt-7788",
      campaign_name: "Verano COD",
      metric_date: "2026-10-09",
      spend: 25,
    });

    assert.equal(
      matchUtmCampaignToAdCampaign(meta.external_campaign_id!, campaigns, "meta")?.campaignId,
      "camp-meta",
    );
    assert.equal(
      matchUtmCampaignToAdCampaign(tiktok.external_campaign_id!, campaigns, "tiktok")?.campaignId,
      "camp-tiktok",
    );
    assert.notEqual(
      matchUtmCampaignToAdCampaign("verano_cod", campaigns, "meta")?.campaignId,
      "camp-tiktok",
    );
  });

  it("uses one stable Purchase event id for Meta CAPI and TikTok Events", () => {
    const first = purchaseConversionEventId("order-1");
    const second = purchaseConversionEventId("order-1");
    assert.equal(first, "purchase:order-1");
    assert.equal(second, first);
    assert.notEqual(purchaseConversionEventId("order-2"), first);
  });

  it("does not emit a second Purchase after the first sweep already sent it", () => {
    const released = decideSweepAction({
      value: 104,
      orderStatus: "delivered",
      paymentStatus: "cash_collected",
      confirmationStatus: "confirmed",
    });
    assert.equal(released.action, "release");

    const again = decidePurchaseResend({
      id: "evt-1",
      sentAt: "2026-10-09T18:00:00.000Z",
      releaseStatus: "released",
    });
    assert.deepEqual(again, { send: false, reason: "already_sent" });
  });

  it("does not fire Purchase on delivery while cash is still expected", () => {
    assert.equal(shouldFirePurchaseOnDelivered("cash_expected"), false);
    const held = evaluatePurchaseRelease({
      value: 104,
      orderStatus: "delivered",
      paymentStatus: "cash_expected",
      confirmationStatus: "confirmed",
    });
    assert.equal(held.release, false);
    assert.equal(held.reason, "awaiting_collection");
    assert.equal(
      decideSweepAction({
        value: 104,
        orderStatus: "delivered",
        paymentStatus: "cash_expected",
        confirmationStatus: "confirmed",
      }).action,
      "hold",
    );
  });
});
