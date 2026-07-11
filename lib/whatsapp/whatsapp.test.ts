import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  extractTemplateVariables,
  inferConfirmationFromBody,
  renderTemplate,
} from "@/lib/whatsapp/templates";

describe("whatsapp templates", () => {
  it("extracts and renders variables", () => {
    const body = "Hola {{name}}, pedido {{order}}";
    assert.deepEqual(extractTemplateVariables(body), ["name", "order"]);
    const r = renderTemplate(body, { name: "Ana", order: "1" });
    assert.equal(r.text, "Hola Ana, pedido 1");
    assert.deepEqual(r.missing, []);
  });

  it("reports missing placeholders", () => {
    const r = renderTemplate("x {{a}} {{b}}", { a: "1" });
    assert.deepEqual(r.missing, ["b"]);
  });

  it("infers confirm/reject from inbound body", () => {
    assert.equal(inferConfirmationFromBody("SI confirmo"), "confirmed");
    assert.equal(inferConfirmationFromBody("NO quiero"), "rejected");
    assert.equal(inferConfirmationFromBody("tal vez"), "pending");
    assert.equal(inferConfirmationFromBody(""), null);
  });
});
