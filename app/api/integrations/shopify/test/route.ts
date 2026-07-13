import { getUser } from "@/lib/auth/get-session";
import { can } from "@/lib/permissions/can";
import { createClient } from "@/lib/supabase/server";
import { getAccessibleStores } from "@/lib/tenant/get-accessible-stores";
import { testShopifyLiveConnection } from "@/services/shopify-oauth.service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** POST { agencySlug, storeSlug } — GraphQL shop test using stored encrypted token. */
export async function POST(request: Request) {
  try {
    const user = await getUser();
    if (!user) {
      return Response.json({ error: "No autenticado." }, { status: 401 });
    }
    const body = (await request.json()) as { agencySlug?: string; storeSlug?: string };
    const agencySlug = body.agencySlug?.trim() ?? "";
    const storeSlug = body.storeSlug?.trim() ?? "";
    if (!agencySlug || !storeSlug) {
      return Response.json({ error: "Faltan agencySlug o storeSlug." }, { status: 400 });
    }

    const stores = await getAccessibleStores();
    const match = stores.find((s) => s.agencySlug === agencySlug && s.storeSlug === storeSlug);
    if (!match?.storeId) {
      return Response.json({ error: "Sin acceso a la tienda." }, { status: 403 });
    }
    if (!can([match.effectiveRole], "integrations.manage")) {
      return Response.json({ error: "Sin permiso." }, { status: 403 });
    }

    const client = await createClient();
    const result = await testShopifyLiveConnection(client, match.agencyId, match.storeId);
    return Response.json(result, { status: result.ok ? 200 : 502 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error";
    return Response.json({ ok: false, detail: message }, { status: 500 });
  }
}
