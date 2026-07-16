import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  defaultNormalizedForEnviameCode,
  resolveEnviameExternalStatusCode,
} from "@/lib/integrations/enviame/map-status";
import { mapEnviameWebhookToJobPayload } from "@/lib/integrations/enviame/map-webhook";

describe("enviame webhook / status mapping", () => {
  it("maps status_id 7 to IN_TRANSIT", () => {
    assert.equal(resolveEnviameExternalStatusCode({ statusId: 7 }), "IN_TRANSIT");
    assert.equal(defaultNormalizedForEnviameCode("IN_TRANSIT"), "in_transit");
  });

  it("maps status_id 10 to DELIVERED_DOM → delivered", () => {
    assert.equal(resolveEnviameExternalStatusCode({ statusId: 10 }), "DELIVERED_DOM");
    assert.equal(defaultNormalizedForEnviameCode("DELIVERED_DOM"), "delivered");
  });

  it("maps webhook payload to carrier job fields", () => {
    const mapped = mapEnviameWebhookToJobPayload({
      status_id: 7,
      identifier: 139174791,
      status_date: "2026-02-10",
      status_name: "En tránsito",
      imported_id: "6032667002262",
      tracking_number: "9436431244",
      status_information: "EN TRANSITO",
    });
    assert.equal(mapped.ok, true);
    if (!mapped.ok) return;
    assert.equal(mapped.payload.tracking_number, "9436431244");
    assert.equal(mapped.payload.external_status_code, "IN_TRANSIT");
    assert.equal(mapped.payload.order_external_id, "6032667002262");
    assert.equal(mapped.payload.carrier_code, "enviame");
    assert.equal(mapped.payload.mode, "live");
    assert.equal(mapped.payload.source, "enviame.webhook");
    assert.match(mapped.payload.external_event_id, /^enviame:/);
  });

  it("rejects webhook without tracking identity", () => {
    const mapped = mapEnviameWebhookToJobPayload({ status_id: 7, status_name: "En tránsito" });
    assert.equal(mapped.ok, false);
  });
});
