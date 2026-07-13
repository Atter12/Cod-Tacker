import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  brandAssetObjectPath,
  decodeBrandBase64,
  publicUrlForBrandObject,
  resolveBrandMimeAndExt,
} from "@/lib/branding/storage";

describe("branding storage helpers", () => {
  it("builds object paths per agency and kind", () => {
    assert.equal(
      brandAssetObjectPath("agency-1", "logo", "png"),
      "agency-1/logo.png",
    );
  });

  it("resolves mime from filename", () => {
    const resolved = resolveBrandMimeAndExt({ filename: "mark.webp" });
    assert.equal(resolved.contentType, "image/webp");
    assert.equal(resolved.ext, "webp");
  });

  it("decodes data-url base64", () => {
    const bytes = decodeBrandBase64("data:image/png;base64,aGVsbG8=");
    assert.equal(bytes.toString("utf8"), "hello");
  });

  it("builds public storage urls", () => {
    const url = publicUrlForBrandObject("https://xyz.supabase.co", "a1/logo.png");
    assert.match(url, /\/storage\/v1\/object\/public\/agency-branding\/a1\/logo\.png\?t=\d+/);
  });
});
