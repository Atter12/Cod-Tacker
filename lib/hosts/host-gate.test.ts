import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { decideHostGate, isShopifyAppSurface, readHostSplitOrigins } from "@/lib/hosts/host-gate";

const shopify = "https://app.codtracked.com";
const product = "https://cod.codtracked.com";

describe("host split origins", () => {
  it("falls back to the public app url until the product host is set", () => {
    assert.deepEqual(
      readHostSplitOrigins({
        NEXT_PUBLIC_APP_URL: "http://localhost:3000",
        SHOPIFY_APP_URL: "",
        PRODUCT_APP_URL: "",
      }),
      {
        shopifyAppUrl: "http://localhost:3000",
        productAppUrl: "http://localhost:3000",
      },
    );
  });
});

describe("host gate", () => {
  it("does not redirect when both origins share a host", () => {
    const decision = decideHostGate({
      host: "localhost:3000",
      pathname: "/a/acme/billing",
      shopifyAppUrl: "http://localhost:3000",
      productAppUrl: "http://localhost:3000",
    });
    assert.deepEqual(decision, { kind: "next" });
  });

  it("does not redirect an unknown host", () => {
    const decision = decideHostGate({
      host: "cod-tracked.vercel.app",
      pathname: "/billing",
      shopifyAppUrl: shopify,
      productAppUrl: product,
    });
    assert.deepEqual(decision, { kind: "next" });
  });

  it("keeps the embed and shopify connector routes on the app host", () => {
    for (const pathname of [
      "/embed",
      "/embed/",
      "/api/integrations/shopify/callback",
      "/api/integrations/shopify/webhooks",
      "/api/integrations/shopify/embed/session",
      "/shopify/codtracked-attribution.js",
    ]) {
      const decision = decideHostGate({
        host: "app.codtracked.com",
        pathname,
        search: "?shop=demo.myshopify.com",
        shopifyAppUrl: shopify,
        productAppUrl: product,
      });
      assert.equal(isShopifyAppSurface(pathname), true);
      assert.deepEqual(decision, { kind: "next" });
    }
  });

  it("sends billing on the app host to the product without rendering it there", () => {
    const decision = decideHostGate({
      host: "app.codtracked.com",
      pathname: "/a/acme/billing",
      search: "?checkout=success",
      shopifyAppUrl: shopify,
      productAppUrl: product,
    });
    assert.deepEqual(decision, {
      kind: "redirect",
      location: "https://cod.codtracked.com/a/acme/billing?checkout=success",
    });
  });

  it("sends the product console off the shopify host", () => {
    for (const pathname of ["/", "/login", "/a/acme/s/tienda/dashboard"]) {
      const decision = decideHostGate({
        host: "app.codtracked.com",
        pathname,
        shopifyAppUrl: shopify,
        productAppUrl: product,
      });
      assert.equal(decision.kind, "redirect");
      if (decision.kind === "redirect") {
        assert.equal(new URL(decision.location).host, "cod.codtracked.com");
        assert.equal(new URL(decision.location).pathname, pathname);
      }
    }
  });

  it("keeps the console on the product host and sends embed back to the app", () => {
    assert.deepEqual(
      decideHostGate({
        host: "cod.codtracked.com",
        pathname: "/a/acme/billing",
        shopifyAppUrl: shopify,
        productAppUrl: product,
      }),
      { kind: "next" },
    );
    assert.deepEqual(
      decideHostGate({
        host: "cod.codtracked.com",
        pathname: "/embed",
        search: "?shop=demo.myshopify.com&host=abc",
        shopifyAppUrl: shopify,
        productAppUrl: product,
      }),
      {
        kind: "redirect",
        location: "https://app.codtracked.com/embed?shop=demo.myshopify.com&host=abc",
      },
    );
  });
});
