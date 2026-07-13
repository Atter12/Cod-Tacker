import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { agencySlugFromNextPath, normalizeAgencySlugParam } from "@/lib/branding/login-brand-slug";

describe("login brand slug helpers", () => {
  it("extracts agency slug from next paths", () => {
    assert.equal(agencySlugFromNextPath("/a/holistic-ecommerce/branding"), "holistic-ecommerce");
    assert.equal(agencySlugFromNextPath("/a/Acme/s/store-1"), "acme");
    assert.equal(agencySlugFromNextPath("https://app.example/a/demo/stores"), "demo");
    assert.equal(agencySlugFromNextPath("/login"), null);
    assert.equal(agencySlugFromNextPath(undefined), null);
  });

  it("normalizes agency query params", () => {
    assert.equal(normalizeAgencySlugParam(" Holistic-Ecommerce "), "holistic-ecommerce");
    assert.equal(normalizeAgencySlugParam("../evil"), null);
    assert.equal(normalizeAgencySlugParam(""), null);
  });
});
