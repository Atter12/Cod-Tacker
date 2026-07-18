import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  formatConversionTimelineDescription,
  parseConversionChannels,
} from "@/lib/orders/timeline";

describe("order conversion timeline labels", () => {
  it("falls back to platform when custom_data has no channel payloads", () => {
    assert.equal(
      formatConversionTimelineDescription({ platform: "meta", custom_data: { source: "delivered" } }),
      "meta",
    );
  });

  it("shows Meta + TikTok live when both channels succeeded", () => {
    assert.equal(
      formatConversionTimelineDescription({
        platform: "meta",
        status: "sent",
        custom_data: {
          meta: { mode: "live", ok: true },
          tiktok: { mode: "live", ok: true },
        },
      }),
      "meta live · tiktok live",
    );
  });

  it("labels TikTok dry_run distinctly from Meta live/fail", () => {
    assert.equal(
      formatConversionTimelineDescription({
        platform: "meta",
        custom_data: {
          meta: { mode: "live", ok: false },
          tiktok: { mode: "dry_run", ok: true },
        },
      }),
      "meta failed · tiktok dry_run",
    );
  });

  it("parses both channel outcomes for the Conversiones panel", () => {
    const channels = parseConversionChannels({
      meta: { mode: "live", ok: true },
      tiktok: { mode: "live", ok: true },
    });
    assert.deepEqual(
      channels.map((c) => ({ name: c.name, outcome: c.outcome })),
      [
        { name: "meta", outcome: "live" },
        { name: "tiktok", outcome: "live" },
      ],
    );
  });
});
