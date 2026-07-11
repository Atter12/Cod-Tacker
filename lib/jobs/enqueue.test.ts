import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { EnqueueInput, EnqueueResult } from "@/lib/jobs/types";

/**
 * Unit-level idempotency: simulating the select-before-insert gate used by enqueueRawEventAndJob.
 * Full DB uniqueness is covered by the expression unique indexes in the migration.
 */
function simulateIdempotentEnqueue(
  store: Map<string, EnqueueResult>,
  input: Pick<EnqueueInput, "agencyId" | "storeId" | "jobType" | "idempotencyKey"> & {
    rawEventId?: string;
    jobId?: string;
  },
): EnqueueResult {
  const key = [
    input.agencyId,
    input.storeId ?? "00000000-0000-0000-0000-000000000000",
    input.jobType,
    input.idempotencyKey,
  ].join("|");
  const existing = store.get(key);
  if (existing) return { ...existing, created: false };
  const created: EnqueueResult = {
    rawEventId: input.rawEventId ?? `evt-${store.size + 1}`,
    jobId: input.jobId ?? `job-${store.size + 1}`,
    created: true,
  };
  store.set(key, created);
  return created;
}

describe("enqueue idempotency (unit)", () => {
  it("does not create a second job for the same agency/store/jobType/idempotency key", () => {
    const store = new Map<string, EnqueueResult>();
    const input = {
      agencyId: "a1",
      storeId: "s1",
      jobType: "shopify.order.created.mock",
      idempotencyKey: "sync-run-1:1",
    };
    const first = simulateIdempotentEnqueue(store, input);
    const second = simulateIdempotentEnqueue(store, input);
    assert.equal(first.created, true);
    assert.equal(second.created, false);
    assert.equal(second.jobId, first.jobId);
    assert.equal(second.rawEventId, first.rawEventId);
    assert.equal(store.size, 1);
  });

  it("allows distinct idempotency keys", () => {
    const store = new Map<string, EnqueueResult>();
    const a = simulateIdempotentEnqueue(store, {
      agencyId: "a1",
      storeId: "s1",
      jobType: "shopify.order.created.mock",
      idempotencyKey: "k1",
    });
    const b = simulateIdempotentEnqueue(store, {
      agencyId: "a1",
      storeId: "s1",
      jobType: "shopify.order.created.mock",
      idempotencyKey: "k2",
    });
    assert.equal(a.created, true);
    assert.equal(b.created, true);
    assert.notEqual(a.jobId, b.jobId);
    assert.equal(store.size, 2);
  });
});
