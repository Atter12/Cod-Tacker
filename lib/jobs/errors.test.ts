import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  isPermanentJobError,
  isRetryableJobError,
  PermanentJobError,
  RetryableJobError,
} from "@/lib/jobs/errors";

describe("job error classification", () => {
  it("classifies RetryableJobError", () => {
    const err = new RetryableJobError("TRANSIENT", "Reintentar más tarde.");
    assert.equal(isRetryableJobError(err), true);
    assert.equal(isPermanentJobError(err), false);
    assert.equal(err.status, 503);
  });

  it("classifies PermanentJobError", () => {
    const err = new PermanentJobError("INVALID_PAYLOAD", "Payload inválido.");
    assert.equal(isPermanentJobError(err), true);
    assert.equal(isRetryableJobError(err), false);
    assert.equal(err.status, 422);
  });

  it("does not classify plain errors as job errors", () => {
    assert.equal(isRetryableJobError(new Error("x")), false);
    assert.equal(isPermanentJobError(new Error("x")), false);
  });
});
