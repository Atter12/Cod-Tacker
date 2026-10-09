import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, describe, it } from "node:test";
import {
  buildFlipyWalletEmbedUrl,
  decideFlipyWalletTopLevelOpen,
  FLIPY_DEFAULT_EMBED_ORIGIN,
  isFlipyWalletReturnPending,
  navigateFlipyWalletTopLevel,
  stripFlipyWalletReturnParam,
} from "@/lib/integrations/flipy/embed-urls";
import { isFlipyWalletTopupDisabledForStore } from "@/lib/shopify/app-store-review";

const ROOT = resolve(process.cwd());
const APP_ORIGIN = "https://app.codtracked.com";
const ORDER_PAGE = `${APP_ORIGIN}/a/acme/s/tienda/orders/order-1?tab=flipy`;

const ORIGINAL_REVIEW = {
  mode: process.env.SHOPIFY_APP_REVIEW_MODE,
  stores: process.env.SHOPIFY_APP_REVIEW_STORE_IDS,
};

afterEach(() => {
  if (ORIGINAL_REVIEW.mode === undefined) delete process.env.SHOPIFY_APP_REVIEW_MODE;
  else process.env.SHOPIFY_APP_REVIEW_MODE = ORIGINAL_REVIEW.mode;
  if (ORIGINAL_REVIEW.stores === undefined) delete process.env.SHOPIFY_APP_REVIEW_STORE_IDS;
  else process.env.SHOPIFY_APP_REVIEW_STORE_IDS = ORIGINAL_REVIEW.stores;
});

function read(path: string): string {
  return readFileSync(resolve(ROOT, path), "utf8");
}

/**
 * Logistics wallet top-up leaves the embedded app.
 * The card form is on Flipy's host; the merchant returns to the same CODTracked page.
 */
describe("strategic · flipy recarga", () => {
  it("opens the partner recarga page on Flipy and comes back to the same order", () => {
    const embedUrl = buildFlipyWalletEmbedUrl({
      embedOrigin: FLIPY_DEFAULT_EMBED_ORIGIN,
      token: "wallet-token",
    });

    const decision = decideFlipyWalletTopLevelOpen({
      embedUrl,
      returnUrl: ORDER_PAGE,
      appOrigin: APP_ORIGIN,
    });
    assert.equal(decision.open, true);
    if (!decision.open) return;

    const opened = new URL(decision.url);
    assert.equal(opened.origin, FLIPY_DEFAULT_EMBED_ORIGIN);
    assert.equal(opened.pathname, "/partner/recarga");
    assert.equal(opened.searchParams.get("embedMode"), "standalone");
    assert.equal(opened.searchParams.get("token"), "wallet-token");
    assert.notEqual(opened.origin, APP_ORIGIN);
    assert.doesNotMatch(decision.url, /checkout\.stripe\.com|stripe/i);

    const returnUrl = opened.searchParams.get("returnUrl");
    assert.ok(returnUrl);
    const back = new URL(returnUrl);
    assert.equal(back.origin, APP_ORIGIN);
    assert.equal(back.pathname, "/a/acme/s/tienda/orders/order-1");
    assert.equal(back.searchParams.get("tab"), "flipy");
    assert.equal(isFlipyWalletReturnPending(back.search), true);
    assert.equal(
      stripFlipyWalletReturnParam(returnUrl),
      "/a/acme/s/tienda/orders/order-1?tab=flipy",
    );

    const calls: Array<{ url: string; target: string | undefined }> = [];
    const previous = globalThis.window;
    Object.defineProperty(globalThis, "window", {
      configurable: true,
      value: {
        open(url: string, target?: string) {
          calls.push({ url, target });
          return null;
        },
      },
    });
    try {
      navigateFlipyWalletTopLevel(decision.url);
    } finally {
      if (previous === undefined) {
        delete (globalThis as { window?: Window }).window;
      } else {
        Object.defineProperty(globalThis, "window", { configurable: true, value: previous });
      }
    }
    assert.deepEqual(calls, [{ url: decision.url, target: "_top" }]);
  });

  it("refuses a return that is not this app, and refuses a page that is not recarga", () => {
    const embedUrl = buildFlipyWalletEmbedUrl({
      embedOrigin: FLIPY_DEFAULT_EMBED_ORIGIN,
      token: "wallet-token",
    });

    assert.deepEqual(
      decideFlipyWalletTopLevelOpen({ embedUrl, returnUrl: null, appOrigin: APP_ORIGIN }),
      { open: false, reason: "missing_return" },
    );
    assert.equal(
      decideFlipyWalletTopLevelOpen({
        embedUrl,
        returnUrl: "https://checkout.stripe.com/c/pay/cs_test",
        appOrigin: APP_ORIGIN,
      }).open,
      false,
    );
    assert.equal(
      decideFlipyWalletTopLevelOpen({
        embedUrl,
        returnUrl: "https://evil.example/a/acme/s/tienda/orders/order-1",
        appOrigin: APP_ORIGIN,
      }).open,
      false,
    );
    assert.equal(
      decideFlipyWalletTopLevelOpen({
        embedUrl,
        returnUrl: "https://user:secret@app.codtracked.com/a/acme",
        appOrigin: APP_ORIGIN,
      }).open,
      false,
    );
    assert.deepEqual(
      decideFlipyWalletTopLevelOpen({
        embedUrl: "https://flipy-panel.vercel.app/partner/ubicacion?token=map",
        returnUrl: ORDER_PAGE,
        appOrigin: APP_ORIGIN,
      }),
      { open: false, reason: "not_recarga" },
    );
  });

  it("keeps the handoff in review mode and blocks only a listed demo store", () => {
    delete process.env.SHOPIFY_APP_REVIEW_STORE_IDS;
    process.env.SHOPIFY_APP_REVIEW_MODE = "true";
    assert.equal(isFlipyWalletTopupDisabledForStore("store-reviewer"), false);

    process.env.SHOPIFY_APP_REVIEW_MODE = "false";
    process.env.SHOPIFY_APP_REVIEW_STORE_IDS = "store-demo";
    assert.equal(isFlipyWalletTopupDisabledForStore("store-demo"), true);
    assert.equal(isFlipyWalletTopupDisabledForStore("store-live"), false);
  });

  it("wires the button, the action, and the return notice to that same rule", () => {
    const action = read("app/actions/flipy-widgets.ts");
    assert.match(action, /decideFlipyWalletTopLevelOpen\(/);
    assert.doesNotMatch(action, /<iframe/);

    for (const file of [
      "components/integrations/FlipyTransferGananciasPanel.tsx",
      "components/flipy/FlipyCreateShipmentModal.tsx",
    ]) {
      const source = read(file);
      assert.match(source, /navigateFlipyWalletTopLevel\(/);
      assert.match(source, /returnUrl:\s*window\.location\.href/);
      assert.doesNotMatch(source, /<iframe/);
      assert.doesNotMatch(source, /FlipyWalletEmbed/);
    }

    const notice = read("components/flipy/FlipyWalletReturnNotice.tsx");
    assert.match(notice, /isFlipyWalletReturnPending\(window\.location\.search\)/);
    assert.match(notice, /stripFlipyWalletReturnParam\(window\.location\.href\)/);
    assert.match(notice, /router\.refresh\(\)/);

    assert.equal(existsSync(resolve(ROOT, "components/flipy/FlipyWalletEmbed.tsx")), false);
  });
});
