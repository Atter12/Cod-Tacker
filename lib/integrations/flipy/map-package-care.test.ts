import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  FLIPY_PACKAGE_CARE_IDS,
  mapShopifyPackageCare,
} from "@/lib/integrations/flipy/map-package-care";

describe("mapShopifyPackageCare", () => {
  it("returns empty array when no tags or titles", () => {
    assert.deepEqual(mapShopifyPackageCare({}), []);
    assert.deepEqual(mapShopifyPackageCare({ tags: [], lineTitles: [] }), []);
  });

  it("maps fragile tag to fragil", () => {
    assert.deepEqual(mapShopifyPackageCare({ tags: ["fragile", "lima"] }), ["fragil"]);
    assert.deepEqual(mapShopifyPackageCare({ tags: "frágil, express" }), ["fragil"]);
  });

  it("maps glass and liquid tags", () => {
    assert.deepEqual(mapShopifyPackageCare({ tags: ["glass", "gift"] }), ["vidrio"]);
    assert.deepEqual(mapShopifyPackageCare({ tags: ["liquido", "cosmetica"] }), ["liquido"]);
  });

  it("maps food, lightweight and vertical care", () => {
    assert.deepEqual(mapShopifyPackageCare({ tags: ["alimentos"] }), ["alimentos"]);
    assert.deepEqual(mapShopifyPackageCare({ tags: ["liviano"] }), ["liviano"]);
    assert.deepEqual(mapShopifyPackageCare({ tags: ["vertical", "no acostar"] }), ["vertical"]);
  });

  it("deduplicates and preserves rule order", () => {
    assert.deepEqual(
      mapShopifyPackageCare({
        tags: ["vertical", "fragile", "fragil", "glass"],
        lineTitles: ["Botella de vidrio frágil"],
      }),
      ["fragil", "vidrio", "vertical"],
    );
  });

  it("reads care hints from line titles", () => {
    assert.deepEqual(
      mapShopifyPackageCare({
        lineTitles: ["Caja de frutas frescas"],
      }),
      ["alimentos"],
    );
  });

  it("exports all supported Flipy care IDs", () => {
    assert.deepEqual([...FLIPY_PACKAGE_CARE_IDS], [
      "fragil",
      "vidrio",
      "liquido",
      "alimentos",
      "liviano",
      "vertical",
    ]);
  });
});
