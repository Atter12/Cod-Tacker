import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { computeRetryAt, hashSeed, seededUnit } from "@/lib/jobs/backoff";

describe("computeRetryAt", () => {
  it("produces monotonic delays across attempts for a fixed seed (same now)", () => {
    const seed = "test-monotonic";
    const delays: number[] = [];
    const now = Date.now();
    for (let attempt = 1; attempt <= 6; attempt += 1) {
      // Patch: compare pure delay by subtracting a frozen now via Date.now in formula —
      // computeRetryAt uses Date.now(); assert ordering of resulting timestamps when called quickly.
      const at = computeRetryAt(attempt, 1_000, 60_000, seed);
      delays.push(at.getTime() - now);
    }
    for (let i = 1; i < delays.length; i += 1) {
      assert.ok(
        delays[i]! >= delays[i - 1]!,
        `expected delay[${i}]=${delays[i]} >= delay[${i - 1}]=${delays[i - 1]}`,
      );
    }
  });

  it("is deterministic for the same attempt and seed", () => {
    const a = seededUnit("abc", 3);
    const b = seededUnit("abc", 3);
    assert.equal(a, b);
    assert.notEqual(seededUnit("abc", 3), seededUnit("abc", 4));
    assert.equal(hashSeed("x"), hashSeed("x"));
  });

  it("respects maxMs cap", () => {
    const at = computeRetryAt(20, 1_000, 5_000, "cap");
    const delay = at.getTime() - Date.now();
    assert.ok(delay <= 5_000 + 50);
  });
});
