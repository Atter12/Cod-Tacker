import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  matchUtmCampaignAlias,
  matchUtmCampaignToAdCampaign,
  normalizeCampaignKey,
  type CampaignMatchCandidate,
} from "@/lib/attribution/match-campaign";

const candidates: CampaignMatchCandidate[] = [
  {
    id: "11111111-1111-1111-1111-111111111111",
    external_campaign_id: "120330001",
    name: "Verano COD",
    platform: "meta",
  },
  {
    id: "22222222-2222-2222-2222-222222222222",
    external_campaign_id: "778899",
    name: "Verano COD",
    platform: "tiktok",
  },
  {
    id: "33333333-3333-3333-3333-333333333333",
    external_campaign_id: "999",
    name: "Black Friday 2026",
    platform: "meta",
  },
];

describe("normalizeCampaignKey", () => {
  it("collapses spaces punctuation and accents", () => {
    assert.equal(normalizeCampaignKey("Verano COD"), "verano_cod");
    assert.equal(normalizeCampaignKey("verano_cod"), "verano_cod");
    assert.equal(normalizeCampaignKey("  Veráno—COD  "), "verano_cod");
  });
});

describe("matchUtmCampaignAlias", () => {
  it("matches exact and normalized alias keys", () => {
    const aliases = [
      { utm: "promo_julio", campaignId: "33333333-3333-3333-3333-333333333333" },
    ];
    assert.deepEqual(matchUtmCampaignAlias("promo_julio", aliases), {
      campaignId: "33333333-3333-3333-3333-333333333333",
      method: "alias",
    });
    assert.deepEqual(matchUtmCampaignAlias("Promo Julio", aliases), {
      campaignId: "33333333-3333-3333-3333-333333333333",
      method: "alias",
    });
  });
});

describe("matchUtmCampaignToAdCampaign", () => {
  it("prefers manual alias over name match", () => {
    const hit = matchUtmCampaignToAdCampaign(
      "verano_cod",
      candidates,
      "meta",
      [{ utm: "verano_cod", campaignId: "33333333-3333-3333-3333-333333333333" }],
    );
    assert.deepEqual(hit, {
      campaignId: "33333333-3333-3333-3333-333333333333",
      method: "alias",
    });
  });

  it("matches external_campaign_id first when no alias", () => {
    const hit = matchUtmCampaignToAdCampaign("120330001", candidates, "meta");
    assert.deepEqual(hit, {
      campaignId: "11111111-1111-1111-1111-111111111111",
      method: "external_id",
    });
  });

  it("matches exact name case-insensitively", () => {
    const hit = matchUtmCampaignToAdCampaign("black friday 2026", candidates, "meta");
    assert.deepEqual(hit, {
      campaignId: "33333333-3333-3333-3333-333333333333",
      method: "name_exact",
    });
  });

  it("matches normalized name when UTM is slug-like", () => {
    const hit = matchUtmCampaignToAdCampaign("verano_cod", candidates, "meta");
    assert.deepEqual(hit, {
      campaignId: "11111111-1111-1111-1111-111111111111",
      method: "name_normalized",
    });
  });

  it("prefers platform when names collide across Meta and TikTok", () => {
    const meta = matchUtmCampaignToAdCampaign("verano_cod", candidates, "tiktok");
    assert.deepEqual(meta, {
      campaignId: "22222222-2222-2222-2222-222222222222",
      method: "name_normalized",
    });
  });

  it("returns null when normalized match is ambiguous without platform", () => {
    const hit = matchUtmCampaignToAdCampaign("verano_cod", candidates, "other");
    assert.equal(hit, null);
  });

  it("returns null for empty or unknown UTM", () => {
    assert.equal(matchUtmCampaignToAdCampaign("", candidates, "meta"), null);
    assert.equal(matchUtmCampaignToAdCampaign("nope", candidates, "meta"), null);
  });
});
