import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import {
  isFlipyWalletTopupDisabledForStore,
  isShopifyAppReviewMode,
  parseShopifyAppReviewStoreIds,
} from "@/lib/shopify/app-store-review";

const ORIGINAL = {
  mode: process.env.SHOPIFY_APP_REVIEW_MODE,
  stores: process.env.SHOPIFY_APP_REVIEW_STORE_IDS,
};

afterEach(() => {
  if (ORIGINAL.mode === undefined) delete process.env.SHOPIFY_APP_REVIEW_MODE;
  else process.env.SHOPIFY_APP_REVIEW_MODE = ORIGINAL.mode;
  if (ORIGINAL.stores === undefined) delete process.env.SHOPIFY_APP_REVIEW_STORE_IDS;
  else process.env.SHOPIFY_APP_REVIEW_STORE_IDS = ORIGINAL.stores;
});

describe("app-store-review", () => {
  it("parses store id allowlist", () => {
    assert.equal(parseShopifyAppReviewStoreIds(" a ,b, ").has("a"), true);
    assert.equal(parseShopifyAppReviewStoreIds("a,b").has("b"), true);
    assert.equal(parseShopifyAppReviewStoreIds(undefined).size, 0);
  });

  it("keeps the Flipy handoff in review mode and hides it only for listed demo stores", () => {
    delete process.env.SHOPIFY_APP_REVIEW_MODE;
    delete process.env.SHOPIFY_APP_REVIEW_STORE_IDS;
    assert.equal(isShopifyAppReviewMode(), false);
    assert.equal(isFlipyWalletTopupDisabledForStore("store-1"), false);

    process.env.SHOPIFY_APP_REVIEW_MODE = "true";
    assert.equal(isFlipyWalletTopupDisabledForStore("store-1"), false);

    process.env.SHOPIFY_APP_REVIEW_MODE = "false";
    process.env.SHOPIFY_APP_REVIEW_STORE_IDS = "store-review";
    assert.equal(isFlipyWalletTopupDisabledForStore("store-review"), true);
    assert.equal(isFlipyWalletTopupDisabledForStore("other"), false);
  });
});
