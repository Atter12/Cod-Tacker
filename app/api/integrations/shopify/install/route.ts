import { authPaths } from "@/config/auth";
import { startShopifyOAuth } from "@/lib/integrations/shopify/start-oauth";
import { getUser } from "@/lib/auth/get-session";
import { getActiveTenantPreference } from "@/lib/tenant/active-tenant-cookie";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Shopify App URL / install entry.
 * Prefer ?agencySlug=&storeSlug=&shop= when known; otherwise uses active tenant cookie.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const shop = url.searchParams.get("shop")?.trim() ?? "";
  if (!shop) {
    return Response.json({ error: "Falta el parámetro shop." }, { status: 400 });
  }

  let agencySlug = url.searchParams.get("agencySlug")?.trim() ?? "";
  let storeSlug = url.searchParams.get("storeSlug")?.trim() ?? "";

  if (!agencySlug || !storeSlug) {
    const preferred = await getActiveTenantPreference();
    agencySlug = agencySlug || preferred.agencySlug || "";
    storeSlug = storeSlug || preferred.storeSlug || "";
  }

  const user = await getUser();
  if (!user || !agencySlug || !storeSlug) {
    const login = new URL(authPaths.login, request.url);
    login.searchParams.set("next", request.url);
    if (agencySlug) login.searchParams.set("agency", agencySlug);
    return Response.redirect(login, 302);
  }

  return startShopifyOAuth({
    agencySlug,
    storeSlug,
    shopRaw: shop,
    requestUrl: request.url,
  });
}
