/** Flipy Partner API v0.2 packageCare IDs. */
export type FlipyPackageCareId =
  | "fragil"
  | "vidrio"
  | "liquido"
  | "alimentos"
  | "liviano"
  | "vertical";

export const FLIPY_PACKAGE_CARE_IDS = [
  "fragil",
  "vidrio",
  "liquido",
  "alimentos",
  "liviano",
  "vertical",
] as const satisfies readonly FlipyPackageCareId[];

export const FLIPY_PACKAGE_CARE_LABELS: Record<FlipyPackageCareId, string> = {
  fragil: "Frágil",
  vidrio: "Vidrio",
  liquido: "Líquido",
  alimentos: "Alimentos",
  liviano: "Liviano",
  vertical: "Mantener vertical",
};

type CareRule = {
  id: FlipyPackageCareId;
  pattern: RegExp;
};

const CARE_RULES: CareRule[] = [
  { id: "fragil", pattern: /\b(fragile|fragil|fr[aá]gil|delicad[oa]|handle\s*with\s*care)\b/i },
  { id: "vidrio", pattern: /\b(glass|vidrio|cristal|cer[aá]mica)\b/i },
  { id: "liquido", pattern: /\b(liquid|l[ií]quido|aceite|perfume|gel|shampoo|bebida)\b/i },
  { id: "alimentos", pattern: /\b(food|alimento|alimentos|comida|fruta|frutas|perecedero|congelad[oa])\b/i },
  { id: "liviano", pattern: /\b(liviano|lightweight|light\s*weight|ultralight)\b/i },
  {
    id: "vertical",
    pattern: /\b(vertical|no\s*acostar|upright|this\s*side\s*up|mantener\s*vertical)\b/i,
  },
];

function normalizeTags(tags: string[] | string | null | undefined): string[] {
  if (Array.isArray(tags)) {
    return tags.map((entry) => String(entry).trim()).filter(Boolean);
  }
  if (typeof tags === "string" && tags.trim()) {
    return tags.split(",").map((entry) => entry.trim()).filter(Boolean);
  }
  return [];
}

function collectTextFragments(
  tags: string[] | string | null | undefined,
  lineTitles?: Array<string | null | undefined> | null,
): string[] {
  const fragments = [...normalizeTags(tags)];
  if (Array.isArray(lineTitles)) {
    for (const title of lineTitles) {
      if (typeof title === "string" && title.trim()) fragments.push(title.trim());
    }
  }
  return fragments;
}

/**
 * Map Shopify order tags (and optional line titles) → Flipy packageCare IDs.
 * Returns stable unique IDs in rule order.
 */
export function mapShopifyPackageCare(input: {
  tags?: string[] | string | null;
  lineTitles?: Array<string | null | undefined> | null;
}): FlipyPackageCareId[] {
  const fragments = collectTextFragments(input.tags, input.lineTitles);
  if (fragments.length === 0) return [];

  const haystack = fragments.join(" ").toLowerCase();
  const matched: FlipyPackageCareId[] = [];

  for (const rule of CARE_RULES) {
    if (rule.pattern.test(haystack)) matched.push(rule.id);
  }

  return matched;
}
