import { startShopifyOAuth } from "@/lib/integrations/shopify/start-oauth";
import { getUser } from "@/lib/auth/get-session";
import { getActiveTenantPreference } from "@/lib/tenant/active-tenant-cookie";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Legacy install entry (console connect or old App URL bookmarks).
 *
 * App Store product gates:
 * - Never redirect to /billing or Stripe Checkout.
 * - Unknown tenant / App Store style hit → `/embed` (session token install).
 * - Known tenant + session → OAuth authorize → integrations/shopify.
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
  if (user && agencySlug && storeSlug) {
    return startShopifyOAuth({
      agencySlug,
      storeSlug,
      shopRaw: shop,
      requestUrl: request.url,
    });
  }

  const embed = new URL("/embed", request.url);
  for (const key of ["shop", "host", "hmac", "timestamp", "session", "id_token", "locale"]) {
    const value = url.searchParams.get(key);
    if (value) embed.searchParams.set(key, value);
  }
  if (!embed.searchParams.has("shop")) {
    embed.searchParams.set("shop", shop);
  }
  return Response.redirect(embed, 302);
}
