import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  labelAuditAction,
  labelAttributionModel,
  labelPlatform,
  labelShipmentStatus,
  labelTimelineKind,
} from "@/lib/orders/labels";
import {
  formatConversionTimelineDescription,
  parseConversionChannels,
} from "@/lib/orders/timeline";

describe("order conversion timeline labels", () => {
  it("falls back to platform when custom_data has no channel payloads", () => {
    assert.equal(
      formatConversionTimelineDescription({ platform: "meta", custom_data: { source: "delivered" } }),
      "Meta",
    );
  });

  it("shows Meta + TikTok live when both channels succeeded", () => {
    assert.equal(
      formatConversionTimelineDescription({
        platform: "meta",
        status: "sent",
        custom_data: {
          meta: { mode: "live", ok: true },
          tiktok: { mode: "live", ok: true },
        },
      }),
      "Meta · enviado · TikTok · enviado",
    );
  });

  it("labels TikTok dry_run distinctly from Meta live/fail", () => {
    assert.equal(
      formatConversionTimelineDescription({
        platform: "meta",
        custom_data: {
          meta: { mode: "live", ok: false },
          tiktok: { mode: "dry_run", ok: true },
        },
      }),
      "Meta · falló · TikTok · prueba",
    );
  });

  it("parses both channel outcomes for the Conversiones panel", () => {
    const channels = parseConversionChannels({
      meta: { mode: "live", ok: true },
      tiktok: { mode: "live", ok: true },
    });
    assert.deepEqual(
      channels.map((c) => ({ name: c.name, outcome: c.outcome })),
      [
        { name: "meta", outcome: "live" },
        { name: "tiktok", outcome: "live" },
      ],
    );
  });
});

describe("client-facing timeline labels", () => {
  it("translates shipment statuses from English codes", () => {
    assert.equal(labelShipmentStatus("delivered"), "Entregado");
    assert.equal(labelShipmentStatus("in_transit"), "En tránsito");
    assert.equal(labelShipmentStatus("Delivered"), "Entregado");
  });

  it("translates attribution model and platform", () => {
    assert.equal(labelPlatform("tiktok"), "TikTok");
    assert.equal(labelAttributionModel("utm_last_touch"), "Último toque (UTM)");
  });

  it("translates audit actions and timeline kinds", () => {
    assert.equal(labelAuditAction("order_payment_status_changed"), "Estado de pago actualizado");
    assert.equal(labelTimelineKind("conversion"), "Conversión");
    assert.equal(labelTimelineKind("raw_event"), "Técnico");
  });
});
