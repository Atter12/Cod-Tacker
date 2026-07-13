const AGENCY_PATH_RE = /^\/a\/([a-z0-9][a-z0-9-]*)(?:\/|$)/i;

/** Extract agency slug from a post-login `next` path like `/a/acme/stores`. */
export function agencySlugFromNextPath(next: string | null | undefined): string | null {
  if (!next) return null;
  let path = next.trim();
  try {
    if (path.startsWith("http://") || path.startsWith("https://")) {
      path = new URL(path).pathname;
    }
  } catch {
    return null;
  }
  const match = AGENCY_PATH_RE.exec(path);
  return match?.[1]?.toLowerCase() ?? null;
}

export function normalizeAgencySlugParam(raw: string | null | undefined): string | null {
  const slug = raw?.trim().toLowerCase();
  if (!slug) return null;
  if (!/^[a-z0-9][a-z0-9-]{0,62}$/.test(slug)) return null;
  return slug;
}
