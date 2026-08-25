import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { mapShopifyPackageSize } from "@/lib/integrations/flipy/map-package-size";

describe("mapShopifyPackageSize", () => {
  it("defaults to mediano when lines are empty", () => {
    assert.equal(mapShopifyPackageSize([]), "mediano");
    assert.equal(mapShopifyPackageSize(null), "mediano");
  });

  it("uses total grams when available", () => {
    assert.equal(
      mapShopifyPackageSize([{ title: "Camiseta", quantity: 1, grams: 400 }]),
      "pequeno",
    );
    assert.equal(
      mapShopifyPackageSize([{ title: "Zapatillas", quantity: 1, grams: 800 }]),
      "pequeno",
    );
    assert.equal(
      mapShopifyPackageSize([{ title: "Caja zapatos", quantity: 1, grams: 5_000 }]),
      "mediano",
    );
    assert.equal(
      mapShopifyPackageSize([{ title: "Silla plegable", quantity: 1, grams: 12_000 }]),
      "grande",
    );
  });

  it("aggregates grams across multiple lines", () => {
    assert.equal(
      mapShopifyPackageSize([
        { title: "Item A", quantity: 2, grams: 900 },
        { title: "Item B", quantity: 1, grams: 500 },
      ]),
      "mediano",
    );
  });

  it("accepts weight_kg per unit", () => {
    assert.equal(
      mapShopifyPackageSize([{ title: "Libro", quantity: 1, weight_kg: 0.4 }]),
      "pequeno",
    );
  });

  it("infers grande from title keywords without weight", () => {
    assert.equal(
      mapShopifyPackageSize([{ title: "Televisor 55 pulgadas", quantity: 1 }]),
      "grande",
    );
  });

  it("infers pequeno from title keywords or single small item", () => {
    assert.equal(mapShopifyPackageSize([{ title: "Anillo de plata", quantity: 1 }]), "pequeno");
    assert.equal(mapShopifyPackageSize([{ title: "Polera básica", quantity: 1 }]), "pequeno");
  });

  it("falls back to mediano for generic merchandise", () => {
    assert.equal(
      mapShopifyPackageSize([
        { title: "Combo skincare", quantity: 2 },
        { title: "Crema hidratante", quantity: 1 },
      ]),
      "mediano",
    );
  });
});
