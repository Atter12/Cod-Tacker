import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  META_ADS_MISSING_CREDENTIALS_ERROR,
  normalizeMetaAdAccountId,
  readMetaAdsCredentials,
  resolveMetaAdsCredentials,
} from "@/lib/integrations/meta/env";
import {
  buildMetaInsightsUrl,
  fetchMetaAdsDailySpend,
  mapMetaInsightsToSpendSnapshots,
} from "@/lib/integrations/meta/insights";

describe("Meta Ads Insights (S16)", () => {
  it("normalizes ad account ids with act_ prefix", () => {
    assert.equal(normalizeMetaAdAccountId("123456"), "act_123456");
    assert.equal(normalizeMetaAdAccountId("act_123456"), "act_123456");
  });

  it("resolves credentials from integration settings over env", () => {
    const prevTok = process.env.META_ADS_ACCESS_TOKEN;
    const prevAct = process.env.META_AD_ACCOUNT_ID;
    process.env.META_ADS_ACCESS_TOKEN = "env_tok";
    process.env.META_AD_ACCOUNT_ID = "999";
    try {
      const creds = resolveMetaAdsCredentials(
        { ads_access_token: "bag_tok", ad_account_id: "111" },
        null,
      );
      assert.equal(creds?.accessToken, "bag_tok");
      assert.equal(creds?.adAccountId, "act_111");
      assert.equal(creds?.source, "integration");
    } finally {
      if (prevTok === undefined) delete process.env.META_ADS_ACCESS_TOKEN;
      else process.env.META_ADS_ACCESS_TOKEN = prevTok;
      if (prevAct === undefined) delete process.env.META_AD_ACCOUNT_ID;
      else process.env.META_AD_ACCOUNT_ID = prevAct;
    }
  });

  it("returns null when credentials are incomplete", () => {
    assert.equal(readMetaAdsCredentials({ ads_access_token: "only" }, null), null);
  });

  it("maps Insights rows to daily spend snapshots", () => {
    const rows = mapMetaInsightsToSpendSnapshots(
      [
        {
          spend: "42.5",
          impressions: "1000",
          clicks: "12",
          account_currency: "usd",
          date_start: "2026-07-18",
          date_stop: "2026-07-18",
        },
        { spend: "0", date_start: "bad-date" },
      ],
      { adAccountId: "act_1", currencyFallback: "PEN" },
    );
    assert.equal(rows.length, 1);
    assert.equal(rows[0]?.date, "2026-07-18");
    assert.equal(rows[0]?.spend, 42.5);
    assert.equal(rows[0]?.currency, "USD");
    assert.equal(rows[0]?.campaignExternalId, "act_1");
  });

  it("builds Insights URL with time_increment and account level", () => {
    const url = buildMetaInsightsUrl(
      {
        accessToken: "tok",
        adAccountId: "act_9",
        apiVersion: "v21.0",
        currencyFallback: "PEN",
        source: "env",
      },
      { from: "2026-07-01", to: "2026-07-07" },
    );
    assert.match(url.pathname, /\/v21\.0\/act_9\/insights$/);
    assert.equal(url.searchParams.get("level"), "account");
    assert.equal(url.searchParams.get("time_increment"), "1");
    assert.equal(url.searchParams.get("access_token"), "tok");
  });

  it("fetchMetaAdsDailySpend parses Graph pages", async () => {
    const fetchImpl: typeof fetch = async () =>
      new Response(
        JSON.stringify({
          data: [
            {
              spend: "10",
              impressions: "100",
              clicks: "2",
              account_currency: "PEN",
              date_start: "2026-07-19",
              date_stop: "2026-07-19",
            },
          ],
        }),
        { status: 200 },
      );

    const result = await fetchMetaAdsDailySpend({
      creds: {
        accessToken: "tok",
        adAccountId: "act_1",
        apiVersion: "v21.0",
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
    assert.match(META_ADS_MISSING_CREDENTIALS_ERROR, /META_ADS_ACCESS_TOKEN/);
  });
});
