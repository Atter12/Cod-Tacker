import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  orderStatusFromShipmentStatus,
  shouldApplyCarrierOrderStatus,
  shouldApplyShopifyOrderStatus,
} from "@/lib/orders/status-precedence";

describe("shouldApplyShopifyOrderStatus", () => {
  it("allows Shopify to advance pre-logistics statuses", () => {
    assert.equal(shouldApplyShopifyOrderStatus("created", "confirmed"), true);
    assert.equal(shouldApplyShopifyOrderStatus("confirmed", "shipped"), true);
  });

  it("blocks Shopify from regressing delivered/returned to shipped", () => {
    assert.equal(shouldApplyShopifyOrderStatus("delivered", "shipped"), false);
    assert.equal(shouldApplyShopifyOrderStatus("returned", "confirmed"), false);
    assert.equal(shouldApplyShopifyOrderStatus("lost", "shipped"), false);
    assert.equal(shouldApplyShopifyOrderStatus("closed", "confirmed"), false);
  });

  it("blocks Shopify overwrite of mid-funnel logistics statuses", () => {
    assert.equal(shouldApplyShopifyOrderStatus("in_transit", "shipped"), false);
    assert.equal(shouldApplyShopifyOrderStatus("out_for_delivery", "confirmed"), false);
  });

  it("allows cancel before terminal delivery outcomes", () => {
    assert.equal(shouldApplyShopifyOrderStatus("confirmed", "cancelled"), true);
    assert.equal(shouldApplyShopifyOrderStatus("shipped", "cancelled"), true);
    assert.equal(shouldApplyShopifyOrderStatus("delivered", "cancelled"), false);
  });
});

describe("orderStatusFromShipmentStatus", () => {
  it("maps mid-funnel and terminals", () => {
    assert.equal(orderStatusFromShipmentStatus("in_transit"), "in_transit");
    assert.equal(orderStatusFromShipmentStatus("out_for_delivery"), "out_for_delivery");
    assert.equal(orderStatusFromShipmentStatus("delivered"), "delivered");
    assert.equal(orderStatusFromShipmentStatus("unknown"), null);
  });
});

describe("shouldApplyCarrierOrderStatus", () => {
  it("never regresses order status", () => {
    assert.equal(shouldApplyCarrierOrderStatus("delivered", "in_transit"), false);
    assert.equal(shouldApplyCarrierOrderStatus("shipped", "in_transit"), true);
    assert.equal(shouldApplyCarrierOrderStatus("closed", "delivered"), false);
  });
});
