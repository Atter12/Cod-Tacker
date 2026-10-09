import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, it } from "node:test";

const ROOT = process.cwd();

const SURFACE_DIRS = ["components/shopify", "app/embed", "extensions"];

/** Strings that would mark the embedded app as an external (Stripe) checkout. */
const FORBIDDEN = [/stripe/i, /checkout\.stripe\.com/i, /must stay Free/i, /@stripe\//i];

function walk(dir: string): string[] {
  const abs = resolve(ROOT, dir);
  let entries: string[];
  try {
    entries = readdirSync(abs);
  } catch {
    return [];
  }
  const files: string[] = [];
  for (const name of entries) {
    const full = join(abs, name);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      files.push(...walk(join(dir, name)));
    } else if (/\.(tsx?|jsx?|liquid|json|toml)$/.test(name)) {
      files.push(full);
    }
  }
  return files;
}

describe("shopify app surface has no external checkout", () => {
  it("shopify.app.toml points at /embed and does not keep a Free listing", () => {
    const toml = readFileSync(resolve(ROOT, "shopify.app.toml"), "utf8");
    assert.match(toml, /application_url\s*=\s*"https:\/\/app\.codtracked\.com\/embed"/);
    assert.match(toml, /embedded\s*=\s*true/);
    assert.doesNotMatch(toml, /must stay Free/i);
    assert.doesNotMatch(toml, /stripe/i);
    assert.match(toml, /Shopify App Pricing/);
  });

  it("embed, theme extension, and shopify UI never mention Stripe", () => {
    const files = SURFACE_DIRS.flatMap((dir) => walk(dir));
    assert.equal(files.length > 0, true);
    const hits: string[] = [];
    for (const file of files) {
      const text = readFileSync(file, "utf8");
      for (const pattern of FORBIDDEN) {
        if (pattern.test(text)) hits.push(`${file} matched ${pattern}`);
      }
    }
    assert.deepEqual(hits, []);
  });

  it("plan CTA leaves the iframe for Shopify Admin", () => {
    const source = readFileSync(
      resolve(ROOT, "components/shopify/ShopifyEmbeddedApp.tsx"),
      "utf8",
    );
    assert.match(source, /window\.open\(url,\s*"_top"\)/);
    assert.match(source, /target="_top"/);
    assert.match(source, /pricingPlansUrl/);
    assert.doesNotMatch(source, /stripe/i);
    assert.doesNotMatch(source, /checkout\.stripe|cod\.codtracked\.com\/.*billing/);
  });
});
