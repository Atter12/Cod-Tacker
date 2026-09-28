/**
 * Host split between the Shopify connector and the paid product.
 * No-op when both origins share a host (local, or before PRODUCT_APP_URL is set).
 */

export type HostGateDecision = { kind: "next" } | { kind: "redirect"; location: string };

export type HostGateInput = {
  host: string;
  pathname: string;
  search?: string;
  shopifyAppUrl?: string | null;
  productAppUrl?: string | null;
};

type HostSplitEnv = {
  SHOPIFY_APP_URL?: string;
  PRODUCT_APP_URL?: string;
  NEXT_PUBLIC_APP_URL?: string;
};

export function readHostSplitOrigins(
  env: HostSplitEnv = {
    SHOPIFY_APP_URL: process.env.SHOPIFY_APP_URL,
    PRODUCT_APP_URL: process.env.PRODUCT_APP_URL,
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
  },
): { shopifyAppUrl: string | null; productAppUrl: string | null } {
  const fallback = blankToNull(env.NEXT_PUBLIC_APP_URL);
  return {
    shopifyAppUrl: blankToNull(env.SHOPIFY_APP_URL) ?? fallback,
    productAppUrl: blankToNull(env.PRODUCT_APP_URL) ?? fallback,
  };
}

export function decideHostGate(input: HostGateInput): HostGateDecision {
  const shopifyHost = hostFromUrl(input.shopifyAppUrl);
  const productHost = hostFromUrl(input.productAppUrl);
  if (!shopifyHost || !productHost || shopifyHost === productHost) {
    return { kind: "next" };
  }

  const requestHost = normalizeHost(input.host);
  const pathname = input.pathname.startsWith("/") ? input.pathname : `/${input.pathname}`;
  const search = input.search ?? "";

  if (requestHost === shopifyHost) {
    if (isShopifyAppSurface(pathname)) return { kind: "next" };
    return {
      kind: "redirect",
      location: absoluteOn(input.productAppUrl!, pathname, search),
    };
  }

  if (requestHost === productHost && isEmbedPath(pathname)) {
    return {
      kind: "redirect",
      location: absoluteOn(input.shopifyAppUrl!, pathname, search),
    };
  }

  return { kind: "next" };
}

function isEmbedPath(pathname: string): boolean {
  return pathname === "/embed" || pathname.startsWith("/embed/");
}

/** Routes that stay on the Shopify app host. Everything else is the product. */
export function isShopifyAppSurface(pathname: string): boolean {
  if (isEmbedPath(pathname)) return true;
  if (
    pathname === "/api/integrations/shopify" ||
    pathname.startsWith("/api/integrations/shopify/")
  ) {
    return true;
  }
  if (pathname === "/shopify/codtracked-attribution.js") return true;
  if (pathname.startsWith("/_next/")) return true;
  if (pathname === "/favicon.ico") return true;
  return false;
}

function absoluteOn(base: string, pathname: string, search: string): string {
  const url = new URL(base);
  url.pathname = pathname;
  url.search = search;
  url.hash = "";
  return url.toString();
}

function blankToNull(value: string | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function hostFromUrl(raw: string | null | undefined): string | null {
  if (!raw?.trim()) return null;
  try {
    const withProtocol = raw.includes("://") ? raw.trim() : `https://${raw.trim()}`;
    return new URL(withProtocol).host.toLowerCase();
  } catch {
    return null;
  }
}

function normalizeHost(host: string): string {
  return host.split(",")[0]?.trim().toLowerCase() ?? "";
}
