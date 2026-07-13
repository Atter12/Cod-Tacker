import { startShopifyOAuth } from "@/lib/integrations/shopify/start-oauth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Start Shopify OAuth from the CODTracked UI.
 * GET ?agencySlug=&storeSlug=&shop=mi-tienda.myshopify.com
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const agencySlug = url.searchParams.get("agencySlug")?.trim() ?? "";
  const storeSlug = url.searchParams.get("storeSlug")?.trim() ?? "";
  const shop = url.searchParams.get("shop")?.trim() ?? "";

  if (!agencySlug || !storeSlug || !shop) {
    return Response.json(
      { error: "Faltan agencySlug, storeSlug o shop." },
      { status: 400 },
    );
  }

  return startShopifyOAuth({
    agencySlug,
    storeSlug,
    shopRaw: shop,
    requestUrl: request.url,
  });
}
