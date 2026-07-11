import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseOrderListView, statusesForOrderListView } from "@/lib/orders/list-view";

describe("order list view", () => {
  it("defaults unknown views to all", () => {
    assert.equal(parseOrderListView(undefined), "all");
    assert.equal(parseOrderListView("nope"), "all");
    assert.equal(parseOrderListView("delivered"), "delivered");
  });

  it("maps semantic tabs to order statuses", () => {
    assert.equal(statusesForOrderListView("all"), undefined);
    assert.deepEqual(statusesForOrderListView("pending"), ["created", "pending_confirmation"]);
    assert.ok(statusesForOrderListView("confirmed")?.includes("shipped"));
    assert.deepEqual(statusesForOrderListView("delivered"), ["delivered", "closed"]);
    assert.deepEqual(statusesForOrderListView("returned"), ["returned", "return_in_transit"]);
  });
});
