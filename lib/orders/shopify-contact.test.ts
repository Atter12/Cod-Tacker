import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  displayShopifyContact,
  missingShopifyContactLabel,
} from "@/lib/orders/shopify-contact";

describe("shopify contact empty labels", () => {
  it("uses Shopify-specific copy for shopify sources", () => {
    assert.equal(missingShopifyContactLabel("phone", "shopify"), "Shopify no envió teléfono");
    assert.equal(missingShopifyContactLabel("email", "shopify.mock"), "Shopify no envió email");
    assert.equal(missingShopifyContactLabel("name", null), "Shopify no envió nombre");
  });

  it("uses generic copy for non-shopify sources", () => {
    assert.equal(missingShopifyContactLabel("phone", "manual"), "Sin teléfono");
  });

  it("returns value when present", () => {
    assert.equal(displayShopifyContact(" +51 999 ", "phone", "shopify"), "+51 999");
    assert.equal(
      displayShopifyContact("  ", "phone", "shopify"),
      "Shopify no envió teléfono",
    );
  });
});
