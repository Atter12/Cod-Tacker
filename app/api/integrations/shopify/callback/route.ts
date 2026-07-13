import { getPublicEnv } from "@/config/env";
import { writeAuditLog } from "@/lib/audit/write-audit";
import { assertShopifyShopDomain } from "@/lib/integrations/shopify/domain";
import { getShopifyEnv } from "@/lib/integrations/shopify/env";
import { verifyShopifyOAuthHmac } from "@/lib/integrations/shopify/hmac";
import { parseShopifyOAuthState } from "@/lib/integrations/shopify/oauth-state";
import { shopifyIntegrationsReturnUrl } from "@/lib/integrations/shopify/start-oauth";
import { createClient } from "@/lib/supabase/server";
import { completeShopifyOAuth } from "@/services/shopify-oauth.service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const { appUrl } = getShopifyEnv();
  const publicApp = getPublicEnv().NEXT_PUBLIC_APP_URL.replace(/\/$/, "");

  const query: Record<string, string | undefined> = {};
  url.searchParams.forEach((value, key) => {
    query[key] = value;
  });

  const code = query.code;
  const shopRaw = query.shop;
  const stateRaw = query.state;

  const fail = (agencySlug: string | null, storeSlug: string | null, message: string) => {
    if (agencySlug && storeSlug) {
      return Response.redirect(
        new URL(
          shopifyIntegrationsReturnUrl(agencySlug, storeSlug, { shopify_error: message }),
          publicApp,
        ),
        302,
      );
    }
    return Response.redirect(new URL(`/?shopify_error=${encodeURIComponent(message)}`, publicApp), 302);
  };

  let stateAgency: string | null = null;
  let stateStore: string | null = null;

  try {
    const env = getShopifyEnv();
    if (!verifyShopifyOAuthHmac(query, env.clientSecret)) {
      return fail(null, null, "HMAC inválido");
    }
    if (!code || !shopRaw || !stateRaw) {
      return fail(null, null, "Callback incompleto");
    }

    const state = parseShopifyOAuthState(stateRaw);
    stateAgency = state.agencySlug;
    stateStore = state.storeSlug;
    const shop = assertShopifyShopDomain(shopRaw);

    const client = await createClient();
    const row = await completeShopifyOAuth(client, { state, shop, code });

    await writeAuditLog({
      action: "integration_connected",
      entityType: "integration",
      entityId: row.id,
      actorId: state.userId,
      agencyId: state.agencyId,
      storeId: state.storeId,
      newData: { provider: "shopify", shop, mode: "live" },
    });

    return Response.redirect(
      new URL(
        shopifyIntegrationsReturnUrl(state.agencySlug, state.storeSlug, {
          shopify: "connected",
        }),
        appUrl || publicApp,
      ),
      302,
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error OAuth Shopify";
    return fail(stateAgency, stateStore, message.slice(0, 180));
  }
}
