export type FlipyPackageSize = "pequeno" | "mediano" | "grande";

export const FLIPY_PACKAGE_SIZE_LABELS: Record<FlipyPackageSize, string> = {
  pequeno: "Pequeño",
  mediano: "Mediano",
  grande: "Grande",
};

export const FLIPY_PACKAGE_SIZE_HINTS: Record<FlipyPackageSize, string> = {
  pequeno: "≤ 2 kg",
  mediano: "≤ 10 kg",
  grande: "> 10 kg",
};

export type FlipyPackageSizeLineInput = {
  title?: string | null;
  product_title?: string | null;
  variant_title?: string | null;
  quantity?: number | null;
  /** Weight per unit in grams (Shopify REST `grams`). */
  grams?: number | null;
  /** Weight per unit in kilograms when grams unavailable. */
  weight_kg?: number | null;
};

/** pequeno ≤ 2 kg total · mediano ≤ 10 kg · grande above. */
const PEQUENO_MAX_GRAMS = 2_000;
const MEDIANO_MAX_GRAMS = 10_000;

const GRANDE_TEXT =
  /\b(grande|large|xl|xxl|bulk|bulky|mueble|furniture|electro|refrigerador|televisor|tv|monitor|bici|bicicleta|caja\s*grande)\b/i;

const PEQUENO_TEXT =
  /\b(peque[nñ]o|small|xs|mini|accesorio|accesorios|joya|joyas|anillo|cadena|cosmetico|labial|perfume)\b/i;

function lineText(line: FlipyPackageSizeLineInput): string {
  return [line.title, line.product_title, line.variant_title]
    .map((value) => (typeof value === "string" ? value.trim() : ""))
    .filter(Boolean)
    .join(" ");
}

function lineQuantity(line: FlipyPackageSizeLineInput): number {
  return typeof line.quantity === "number" && line.quantity > 0 ? line.quantity : 1;
}

function lineGrams(line: FlipyPackageSizeLineInput): number | null {
  if (typeof line.grams === "number" && Number.isFinite(line.grams) && line.grams >= 0) {
    return line.grams * lineQuantity(line);
  }
  if (typeof line.weight_kg === "number" && Number.isFinite(line.weight_kg) && line.weight_kg >= 0) {
    return line.weight_kg * 1_000 * lineQuantity(line);
  }
  return null;
}

/**
 * Infer Flipy package size from Shopify line items.
 * Uses weight when present; otherwise title heuristics. Defaults to mediano.
 */
export function mapShopifyPackageSize(
  lines: FlipyPackageSizeLineInput[] | null | undefined,
): FlipyPackageSize {
  if (!Array.isArray(lines) || lines.length === 0) return "mediano";

  let totalGrams = 0;
  let hasWeight = false;
  let hasGrandeKeyword = false;
  let hasPequenoKeyword = false;
  let totalQuantity = 0;

  for (const line of lines) {
    if (!line) continue;
    const grams = lineGrams(line);
    if (grams != null) {
      hasWeight = true;
      totalGrams += grams;
    }

    const text = lineText(line);
    if (GRANDE_TEXT.test(text)) hasGrandeKeyword = true;
    if (PEQUENO_TEXT.test(text)) hasPequenoKeyword = true;
    totalQuantity += lineQuantity(line);
  }

  if (hasWeight) {
    if (totalGrams <= PEQUENO_MAX_GRAMS) return "pequeno";
    if (totalGrams <= MEDIANO_MAX_GRAMS) return "mediano";
    return "grande";
  }

  if (hasGrandeKeyword) return "grande";
  if (hasPequenoKeyword || (lines.length === 1 && totalQuantity === 1)) return "pequeno";

  return "mediano";
}
