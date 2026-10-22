import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";

const layout = readFileSync(resolve(process.cwd(), "app/layout.tsx"), "utf8");

describe("App Bridge in the root layout", () => {
  it("loads App Bridge as a plain synchronous script inside <head>", () => {
    const head = layout.slice(layout.indexOf("<head>"), layout.indexOf("</head>"));
    assert.ok(head.length > 0, "layout renders <head>");
    assert.match(head, /<meta name="shopify-api-key" content=\{shopifyApiKey\} \/>/);
    assert.match(head, /<script src=\{APP_BRIDGE_SRC\} \/>/);
    assert.match(layout, /APP_BRIDGE_SRC = "https:\/\/cdn\.shopify\.com\/shopifycloud\/app-bridge\.js"/);
  });

  it("does not inject App Bridge through next/script (it would load async)", () => {
    assert.doesNotMatch(layout, /from "next\/script"/);
    for (const tag of layout.match(/<script\b[^>]*>/g) ?? []) {
      assert.doesNotMatch(tag, /\b(async|defer|strategy)\b|type="module"/, tag);
    }
  });
});
