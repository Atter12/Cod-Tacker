/**
 * Deterministic mock ads hierarchy + attribution touchpoints for Sprint 6.
 * Used by job handler and unit tests — no live Meta/TikTok calls.
 */

export type MockAdsSeed = {
  platform: "meta" | "tiktok";
  externalAccountId: string;
  campaigns: Array<{
    externalId: string;
    name: string;
    profitable: boolean;
    highRto: boolean;
    spend: number;
    impressions: number;
    clicks: number;
    adSets: Array<{
      externalId: string;
      name: string;
      ads: Array<{ externalId: string; name: string }>;
    }>;
  }>;
  metricDate: string;
};

export function buildMockAdsSeed(storeSlug: string, dayOffset = 0): MockAdsSeed {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - dayOffset);
  const metricDate = d.toISOString().slice(0, 10);
  const slug = storeSlug.slice(0, 24) || "store";

  return {
    platform: "meta",
    externalAccountId: `mock-meta-${slug}`,
    metricDate,
    campaigns: [
      {
        externalId: `camp-profit-${slug}`,
        name: "Prospecting · Alta conversión",
        profitable: true,
        highRto: false,
        spend: 120,
        impressions: 40_000,
        clicks: 1_200,
        adSets: [
          {
            externalId: `adset-profit-${slug}`,
            name: "Lookalike 1%",
            ads: [
              { externalId: `ad-profit-a-${slug}`, name: "Creative A" },
              { externalId: `ad-profit-b-${slug}`, name: "Creative B" },
            ],
          },
        ],
      },
      {
        externalId: `camp-rto-${slug}`,
        name: "Retargeting · RTO alto",
        profitable: false,
        highRto: true,
        spend: 80,
        impressions: 25_000,
        clicks: 900,
        adSets: [
          {
            externalId: `adset-rto-${slug}`,
            name: "Cart abandoners",
            ads: [{ externalId: `ad-rto-${slug}`, name: "RTO Creative" }],
          },
        ],
      },
    ],
  };
}
