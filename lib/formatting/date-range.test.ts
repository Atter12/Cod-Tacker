import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  dateRangeToBounds,
  startOfZonedDay,
  zonedWallTimeToUtc,
} from "@/lib/formatting/date-range";
import { dayKey, eachDayKey } from "@/lib/dashboard/metrics";

describe("dateRangeToBounds store timezone", () => {
  it("maps America/Lima midnight to 05:00Z", () => {
    const start = zonedWallTimeToUtc(2026, 7, 16, 0, 0, 0, "America/Lima");
    assert.equal(start.toISOString(), "2026-07-16T05:00:00.000Z");
  });

  it("starts Hoy at store-local midnight, not UTC midnight", () => {
    // 2026-07-16 02:30 UTC = still 2026-07-15 21:30 in Lima
    const now = new Date("2026-07-16T02:30:00.000Z");
    const { from, to } = dateRangeToBounds("today", now, "America/Lima");
    assert.equal(from.toISOString(), "2026-07-15T05:00:00.000Z");
    assert.equal(to.toISOString(), now.toISOString());
    assert.equal(dayKey(from, "America/Lima"), "2026-07-15");
    assert.deepEqual(eachDayKey(from.toISOString(), to.toISOString(), "America/Lima"), [
      "2026-07-15",
    ]);
  });

  it("uses Lima calendar day after UTC midnight when Lima day already rolled", () => {
    // 2026-07-16 10:00 UTC = 2026-07-16 05:00 in Lima
    const now = new Date("2026-07-16T10:00:00.000Z");
    const { from } = dateRangeToBounds("today", now, "America/Lima");
    assert.equal(from.toISOString(), "2026-07-16T05:00:00.000Z");
    assert.equal(startOfZonedDay(now, "America/Lima").toISOString(), "2026-07-16T05:00:00.000Z");
  });

  it("builds month start in store timezone", () => {
    const now = new Date("2026-07-16T18:00:00.000Z");
    const { from } = dateRangeToBounds("month", now, "America/Lima");
    assert.equal(from.toISOString(), "2026-07-01T05:00:00.000Z");
  });
});
