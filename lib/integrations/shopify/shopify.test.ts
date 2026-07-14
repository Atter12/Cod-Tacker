import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createHmac } from "node:crypto";
import { normalizeShopifyShopDomain } from "@/lib/integrations/shopify/domain";
import { shopifyGidToExternalId } from "@/lib/integrations/shopify/map-order";
import { verifyShopifyOAuthHmac, verifyShopifyWebhookHmac } from "@/lib/integrations/shopify/hmac";
import {
  mapRestOrderToCreatedPayload,
  mapRestOrderToUpdatedPayload,
} from "@/lib/integrations/shopify/map-order";
import { shopifyWebhookCallbackUri, summarizeShopifyWebhooks } from "@/lib/integrations/shopify/webhooks-meta";

describe("shopify domain", () => {
  it("normalizes myshopify domains", () => {
    assert.equal(normalizeShopifyShopDomain("Mi-Tienda"), "mi-tienda.myshopify.com");
    assert.equal(
      normalizeShopifyShopDomain("https://demo.myshopify.com/admin"),
      "demo.myshopify.com",
    );
    assert.equal(normalizeShopifyShopDomain("not a shop"), null);
  });
});

describe("shopify oauth hmac", () => {
  it("accepts a valid hmac", () => {
    const secret = "shpss_test_secret";
    const query = {
      code: "abc",
      shop: "demo.myshopify.com",
      state: "xyz",
      timestamp: "123",
    };
    const message = Object.keys(query)
      .sort()
      .map((k) => `${k}=${query[k as keyof typeof query]}`)
      .join("&");
    const hmac = createHmac("sha256", secret).update(message).digest("hex");
    assert.equal(verifyShopifyOAuthHmac({ ...query, hmac }, secret), true);
    assert.equal(verifyShopifyOAuthHmac({ ...query, hmac: "deadbeef" }, secret), false);
  });
});

describe("shopify webhook hmac", () => {
  it("accepts a valid base64 body hmac", () => {
    const secret = "shpss_test_secret";
    const body = '{"id":1}';
    const hmac = createHmac("sha256", secret).update(body).digest("base64");
    assert.equal(verifyShopifyWebhookHmac(body, hmac, secret), true);
    assert.equal(verifyShopifyWebhookHmac(body, "bad", secret), false);
  });
});

describe("shopify webhook metadata summary", () => {
  it("builds callback URI without trailing slash issues", () => {
    assert.equal(
      shopifyWebhookCallbackUri("https://app.example.com/"),
      "https://app.example.com/api/integrations/shopify/webhooks",
    );
  });

  it("summarizes registered webhooks", () => {
    const summary = summarizeShopifyWebhooks({
      registered_at: "2026-07-14T12:00:00.000Z",
      callback_uri: "https://app.example.com/api/integrations/shopify/webhooks",
      results: [
        { topic: "ORDERS_CREATE", ok: true, id: "gid://1" },
        { topic: "ORDERS_UPDATED", ok: true, id: "gid://2" },
      ],
    });
    assert.equal(summary.status, "ok");
    assert.match(summary.label, /2\/2/);
  });

  it("summarizes cleared webhooks after disconnect", () => {
    const summary = summarizeShopifyWebhooks({
      unregistered_at: "2026-07-14T13:00:00.000Z",
      unregister_results: [{ id: "gid://1", topic: "ORDERS_CREATE", ok: true }],
    });
    assert.equal(summary.status, "cleared");
  });
});

describe("shopify order mapping", () => {
  it("maps REST create payloads", () => {
    const payload = mapRestOrderToCreatedPayload({
      id: 998877,
      name: "#1001",
      currency: "pen",
      total_price: "149.90",
      subtotal_price: "140.00",
    });
    assert.equal(payload.external_order_id, "998877");
    assert.equal(payload.order_number, "1001");
    assert.equal(payload.currency_code, "PEN");
    assert.equal(payload.total_amount, 149.9);
    assert.equal(payload.mode, "live");
    assert.equal(payload.order_status, undefined);
    assert.equal(payload.customer, undefined);
    assert.deepEqual(payload.line_items, []);
    assert.equal(payload.payment_kind, "cod");
    assert.equal(payload.payment_status, "cash_expected");
    assert.equal(payload.expected_cod_amount, 149.9);
  });

  it("maps customer + shipping from REST webhook body", () => {
    const payload = mapRestOrderToCreatedPayload({
      id: 42,
      name: "#1002",
      currency: "PEN",
      total_price: "80",
      email: "Buyer@Shop.pe",
      phone: "+51 999 111 222",
      customer: {
        id: 777,
        first_name: "Ana",
        last_name: "Ruiz",
        email: "ana@example.com",
        phone: null,
      },
      shipping_address: {
        first_name: "Ana",
        last_name: "Ruiz",
        phone: "+51 999 111 222",
        city: "Lima",
        province: "Lima",
        zip: "15001",
        country_code: "PE",
        address2: "Miraflores",
      },
    });
    assert.deepEqual(payload.customer, {
      external_customer_id: "777",
      email: "ana@example.com",
      phone: "+51 999 111 222",
      first_name: "Ana",
      last_name: "Ruiz",
      country_code: "PE",
      city: "Lima",
      region: "Lima",
      postal_code: "15001",
    });
    assert.deepEqual(payload.shipping, {
      country_code: "PE",
      region: "Lima",
      city: "Lima",
      district: "Miraflores",
      postal_code: "15001",
    });
  });

  it("maps guest checkout from shipping address only", () => {
    const payload = mapRestOrderToCreatedPayload({
      id: 43,
      name: "#1003",
      currency: "PEN",
      total_price: "50",
      customer: null,
      shipping_address: {
        first_name: "Luis",
        last_name: "COD",
        phone: "51999888777",
        city: "Arequipa",
        country_code: "PE",
      },
    });
    assert.equal(payload.customer?.external_customer_id, undefined);
    assert.equal(payload.customer?.first_name, "Luis");
    assert.equal(payload.customer?.phone, "51999888777");
    assert.equal(payload.shipping?.city, "Arequipa");
  });

  it("maps paid create payloads to confirmed", () => {
    const payload = mapRestOrderToCreatedPayload({
      id: 2,
      name: "#1004",
      currency: "USD",
      total_price: "52.00",
      financial_status: "paid",
      fulfillment_status: null,
    });
    assert.equal(payload.order_status, "confirmed");
    assert.equal(payload.payment_kind, "prepaid");
    assert.equal(payload.payment_status, "unpaid");
    assert.equal(payload.expected_cod_amount, null);
  });

  it("keeps COD shape when tag says contraentrega even if paid", () => {
    const payload = mapRestOrderToCreatedPayload({
      id: 3,
      name: "#1007",
      currency: "PEN",
      total_price: "99.00",
      financial_status: "paid",
      tags: "contraentrega, organic",
      payment_gateway_names: ["Cash on Delivery (COD)"],
    });
    assert.equal(payload.order_status, "confirmed");
    assert.equal(payload.payment_kind, "cod");
    assert.equal(payload.payment_status, "cash_expected");
    assert.equal(payload.expected_cod_amount, 99);
  });

  it("defaults ambiguous pending orders to COD", () => {
    const payload = mapRestOrderToCreatedPayload({
      id: 4,
      name: "#1008",
      currency: "PEN",
      total_price: "40",
      financial_status: "pending",
    });
    assert.equal(payload.payment_kind, "cod");
    assert.equal(payload.payment_status, "cash_expected");
    assert.equal(payload.expected_cod_amount, 40);
  });

  it("maps mercadopago paid orders as prepaid", () => {
    const payload = mapRestOrderToCreatedPayload({
      id: 5,
      name: "#1009",
      currency: "PEN",
      total_price: "70",
      financial_status: "pending",
      payment_gateway_names: ["Mercado Pago"],
    });
    assert.equal(payload.payment_kind, "prepaid");
    assert.equal(payload.payment_status, "unpaid");
    assert.equal(payload.expected_cod_amount, null);
  });

  it("maps cancelled updated payloads", () => {
    const payload = mapRestOrderToUpdatedPayload({
      id: 1,
      cancelled_at: "2026-07-14T00:00:00Z",
      currency: "USD",
      total_price: "10",
    });
    assert.equal(payload.order_status, "cancelled");
  });

  it("maps REST line items with product and variant ids", () => {
    const payload = mapRestOrderToCreatedPayload({
      id: 100,
      name: "#1005",
      currency: "PEN",
      total_price: "45.00",
      line_items: [
        {
          id: 9001,
          product_id: 55,
          variant_id: 66,
          title: "Jabón de avena",
          sku: "JAB-01",
          quantity: 2,
          price: "20.00",
          total_discount: "5.00",
          vendor: "Casa COD",
          variant_title: "250g",
        },
        {
          id: 9002,
          product_id: 56,
          variant_id: 67,
          title: "Pan integral",
          quantity: 1,
          price: "10.00",
          total_discount: "0",
        },
      ],
    });
    assert.equal(payload.line_items?.length, 2);
    assert.deepEqual(payload.line_items?.[0], {
      external_line_item_id: "9001",
      external_product_id: "55",
      external_variant_id: "66",
      title: "Jabón de avena",
      sku: "JAB-01",
      quantity: 2,
      unit_price: 20,
      total_discount: 5,
      total_price: 35,
      vendor: "Casa COD",
      product_title: "Jabón de avena",
      variant_title: "250g",
    });
    assert.equal(payload.line_items?.[1]?.title, "Pan integral");
    assert.equal(payload.line_items?.[1]?.total_price, 10);
  });

  it("skips invalid REST line items", () => {
    const payload = mapRestOrderToCreatedPayload({
      id: 101,
      name: "#1006",
      currency: "PEN",
      total_price: "0",
      line_items: [
        { id: 1, title: "Ok", quantity: 1, price: "5" },
        { id: 2, title: "Zero qty", quantity: 0, price: "5" },
        { title: "No id", quantity: 1, price: "5" },
      ],
    });
    assert.equal(payload.line_items?.length, 1);
    assert.equal(payload.line_items?.[0]?.external_line_item_id, "1");
  });

  it("extracts numeric ids from GIDs", () => {
    assert.equal(shopifyGidToExternalId("gid://shopify/Order/12345"), "12345");
    assert.equal(shopifyGidToExternalId("99"), "99");
  });

  it("maps UTMs and fbclid from landing_site query", () => {
    const payload = mapRestOrderToCreatedPayload({
      id: 90,
      name: "#1090",
      currency: "PEN",
      total_price: "40",
      landing_site:
        "/products/demo?utm_source=facebook&utm_medium=cpc&utm_campaign=julio&fbclid=FbClick123",
      referring_site: "https://l.facebook.com/",
    });
    assert.equal(payload.attribution?.has_attribution, true);
    assert.equal(payload.attribution?.utm_source, "facebook");
    assert.equal(payload.attribution?.utm_medium, "cpc");
    assert.equal(payload.attribution?.utm_campaign, "julio");
    assert.equal(payload.attribution?.fbclid, "FbClick123");
    assert.equal(payload.attribution?.platform, "meta");
    assert.equal(payload.attribution?.landing_site?.includes("utm_source=facebook"), true);
  });

  it("marks sin atribución when landing has no UTM or click ids", () => {
    const payload = mapRestOrderToCreatedPayload({
      id: 91,
      name: "#1091",
      currency: "PEN",
      total_price: "40",
      landing_site: "/products/demo",
      referring_site: "https://google.com/",
    });
    assert.equal(payload.attribution?.has_attribution, false);
    assert.equal(payload.attribution?.landing_site, "/products/demo");
    assert.equal(payload.attribution?.fbclid, null);
  });

  it("reads attribution from note_attributes", () => {
    const payload = mapRestOrderToCreatedPayload({
      id: 92,
      name: "#1092",
      currency: "PEN",
      total_price: "40",
      note_attributes: [
        { name: "utm_source", value: "tiktok" },
        { name: "ttclid", value: "TtClick9" },
      ],
    });
    assert.equal(payload.attribution?.has_attribution, true);
    assert.equal(payload.attribution?.utm_source, "tiktok");
    assert.equal(payload.attribution?.ttclid, "TtClick9");
    assert.equal(payload.attribution?.platform, "tiktok");
  });
});
