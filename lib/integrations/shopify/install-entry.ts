/** Where an App Store / legacy install hit goes before any billing surface. */
export type ShopifyInstallEntry = "oauth" | "embed";

/**
 * Known session + tenant continues OAuth into that store.
 * App Store installs and bookmarks without a tenant open `/embed` (never /billing).
 */
export function decideShopifyInstallEntry(input: {
  hasSession: boolean;
  agencySlug: string;
  storeSlug: string;
}): ShopifyInstallEntry {
  if (input.hasSession && input.agencySlug.trim() && input.storeSlug.trim()) return "oauth";
  return "embed";
}
