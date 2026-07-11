import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseCsvEnumParam, parseEnumParam, parsePaginationParams, parseStringParam } from "./search-params";
import { normalizePagination } from "./pagination";

describe("search-params", () => {
  it("parses pagination safely", () => {
    const parsed = parsePaginationParams({ page: "2", pageSize: "50" });
    assert.equal(parsed.page, 2);
    assert.equal(parsed.pageSize, 50);
    assert.equal(parsed.offset, 50);
  });

  it("clamps page size", () => {
    const parsed = normalizePagination(1, 999);
    assert.equal(parsed.pageSize, 100);
  });

  it("parses enums and csv enums", () => {
    const allowed = ["created", "shipped"] as const;
    assert.equal(parseEnumParam({ status: "shipped" }, "status", allowed), "shipped");
    assert.equal(parseEnumParam({ status: "nope" }, "status", allowed), undefined);
    assert.deepEqual(parseCsvEnumParam({ status: "created,shipped,x" }, "status", allowed), [
      "created",
      "shipped",
    ]);
  });

  it("trims and truncates strings", () => {
    assert.equal(parseStringParam({ q: "  hola  " }, "q"), "hola");
    assert.equal(parseStringParam({ q: "abcdef" }, "q", { maxLength: 3 }), "abc");
  });
});
