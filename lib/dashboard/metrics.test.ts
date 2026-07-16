import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  changePercent,
  dayKey,
  eachDayKey,
  isOrderConfirmed,
  previousPeriodBounds,
  ratio,
} from "@/lib/dashboard/metrics";

describe("dashboard metrics helpers", () => {
  it("computes safe change percentages", () => {
    assert.equal(changePercent(110, 100), 10);
    assert.equal(changePercent(0, 0), 0);
    assert.equal(changePercent(5, 0), null);
    assert.ok(Number.isFinite(changePercent(1, 0.0001)!));
  });

  it("builds previous period with equal duration", () => {
    const previous = previousPeriodBounds(
      "2026-06-01T00:00:00.000Z",
      "2026-07-01T00:00:00.000Z",
    );
    assert.equal(previous.to, "2026-06-01T00:00:00.000Z");
    assert.equal(previous.from, "2026-05-02T00:00:00.000Z");
  });

  it("fills continuous day keys without gaps", () => {
    const keys = eachDayKey("2026-01-01T12:00:00.000Z", "2026-01-03T12:00:00.000Z", "UTC");
    assert.deepEqual(keys, ["2026-01-01", "2026-01-02", "2026-01-03"]);
    assert.equal(dayKey("2026-01-02T23:15:00.000Z", "UTC"), "2026-01-02");
  });

  it("buckets late UTC evening into America/Lima calendar day", () => {
    // 2026-01-03 02:00 UTC = 2026-01-02 21:00 in Lima (UTC-5)
    assert.equal(dayKey("2026-01-03T02:00:00.000Z", "America/Lima"), "2026-01-02");
    assert.equal(dayKey("2026-01-03T02:00:00.000Z", "UTC"), "2026-01-03");
  });

  it("treats post-confirmation statuses as confirmed", () => {
    assert.equal(
      isOrderConfirmed({
        confirmed_at: null,
        confirmation_status: "pending",
        order_status: "delivered",
      }),
      true,
    );
    assert.equal(
      isOrderConfirmed({
        confirmed_at: null,
        confirmation_status: "pending",
        order_status: "created",
      }),
      false,
    );
    assert.equal(ratio(3, 0), 0);
  });
});
