/** Human-readable commerce source for list/detail UI (ready for UTM later). */
export function labelOrderSource(sourceName: string | null | undefined): string {
  if (!sourceName?.trim()) return "";
  const raw = sourceName.trim();
  const key = raw.toLowerCase();
  if (key === "shopify") return "Shopify";
  if (key === "manual") return "Manual";
  if (key === "pos") return "POS";
  return raw;
}

export function hasOrderSource(sourceName: string | null | undefined): boolean {
  return Boolean(sourceName?.trim());
}
