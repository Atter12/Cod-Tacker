import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  TIKTOK_ADS_MISSING_CREDENTIALS_ERROR,
  normalizeTikTokAdvertiserId,
  readTikTokAdsCredentials,
  resolveTikTokAdsCredentials,
} from "@/lib/integrations/tiktok/env";
import {
  buildTikTokIntegratedReportUrl,
  fetchTikTokAdsDailySpend,
  mapTikTokReportToSpendSnapshots,
} from "@/lib/integrations/tiktok/insights";

describe("TikTok Ads Reporting (S17)", () => {
  it("normalizes advertiser ids without act_ prefix", () => {
    assert.equal(normalizeTikTokAdvertiserId("123456"), "123456");
    assert.equal(normalizeTikTokAdvertiserId("act_123456"), "123456");
  });

  it("resolves credentials from integration settings over env", () => {
    const prevTok = process.env.TIKTOK_ADS_ACCESS_TOKEN;
    const prevAdv = process.env.TIKTOK_ADVERTISER_ID;
    process.env.TIKTOK_ADS_ACCESS_TOKEN = "env_tok";
    process.env.TIKTOK_ADVERTISER_ID = "999";
    try {
      const creds = resolveTikTokAdsCredentials(
        { ads_access_token: "bag_tok", advertiser_id: "111" },
        null,
      );
      assert.equal(creds?.accessToken, "bag_tok");
      assert.equal(creds?.advertiserId, "111");
      assert.equal(creds?.source, "integration");
    } finally {
      if (prevTok === undefined) delete process.env.TIKTOK_ADS_ACCESS_TOKEN;
      else process.env.TIKTOK_ADS_ACCESS_TOKEN = prevTok;
      if (prevAdv === undefined) delete process.env.TIKTOK_ADVERTISER_ID;
      else process.env.TIKTOK_ADVERTISER_ID = prevAdv;
    }
  });

  it("returns null when credentials are incomplete", () => {
    assert.equal(readTikTokAdsCredentials({ ads_access_token: "only" }, null), null);
  });

  it("maps report rows to daily spend snapshots", () => {
    const rows = mapTikTokReportToSpendSnapshots(
      [
        {
          dimensions: { stat_time_day: "2026-07-18 00:00:00" },
          metrics: {
            spend: "42.5",
            impressions: "1000",
            clicks: "12",
            currency: "usd",
          },
        },
        { dimensions: { stat_time_day: "bad" }, metrics: { spend: "0" } },
      ],
      { advertiserId: "adv_1", currencyFallback: "PEN" },
    );
    assert.equal(rows.length, 1);
    assert.equal(rows[0]?.date, "2026-07-18");
    assert.equal(rows[0]?.spend, 42.5);
    assert.equal(rows[0]?.currency, "USD");
    assert.equal(rows[0]?.campaignExternalId, "adv_1");
  });

  it("builds integrated report URL with advertiser day grain", () => {
    const url = buildTikTokIntegratedReportUrl(
      {
        accessToken: "tok",
        advertiserId: "9",
        apiVersion: "v1.3",
        currencyFallback: "PEN",
        source: "env",
      },
      { from: "2026-07-01", to: "2026-07-07" },
    );
    assert.match(url.pathname, /\/open_api\/v1\.3\/report\/integrated\/get\/$/);
    assert.equal(url.searchParams.get("advertiser_id"), "9");
    assert.equal(url.searchParams.get("data_level"), "AUCTION_ADVERTISER");
    assert.equal(url.searchParams.get("report_type"), "BASIC");
  });

  it("fetchTikTokAdsDailySpend parses report pages", async () => {
    const fetchImpl: typeof fetch = async () =>
      new Response(
        JSON.stringify({
          code: 0,
          message: "OK",
          data: {
            list: [
              {
                dimensions: { stat_time_day: "2026-07-19 00:00:00" },
                metrics: {
                  spend: "10",
                  impressions: "100",
                  clicks: "2",
                },
              },
            ],
            page_info: { page: 1, total_page: 1 },
          },
        }),
        { status: 200 },
      );

    const result = await fetchTikTokAdsDailySpend({
      creds: {
        accessToken: "tok",
        advertiserId: "1",
        apiVersion: "v1.3",
        currencyFallback: "PEN",
        source: "env",
      },
      dateRange: { from: "2026-07-19", to: "2026-07-19" },
      fetchImpl,
    });
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.rows.length, 1);
    assert.equal(result.rows[0]?.spend, 10);
  });

  it("exposes a clear missing-credentials constant", () => {
    assert.match(TIKTOK_ADS_MISSING_CREDENTIALS_ERROR, /TIKTOK_ADS_ACCESS_TOKEN/);
  });
});
