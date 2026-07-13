import "server-only";

import { authPaths } from "@/config/auth";
import { routes } from "@/config/routes";
import { can } from "@/lib/permissions/can";
import { getUser } from "@/lib/auth/get-session";
import { assertShopifyShopDomain } from "@/lib/integrations/shopify/domain";
import { getShopifyEnv } from "@/lib/integrations/shopify/env";
import { buildShopifyAuthorizeUrl } from "@/lib/integrations/shopify/oauth";
import { createShopifyOAuthState } from "@/lib/integrations/shopify/oauth-state";
import { getAccessibleStores } from "@/lib/tenant/get-accessible-stores";

export async function startShopifyOAuth(input: {
  agencySlug: string;
  storeSlug: string;
  shopRaw: string;
  requestUrl: string;
}): Promise<Response> {
  getShopifyEnv(); // validate config early

  const user = await getUser();
  if (!user) {
    const login = new URL(authPaths.login, input.requestUrl);
    login.searchParams.set("next", input.requestUrl);
    return Response.redirect(login, 302);
  }

  const stores = await getAccessibleStores();
  const match = stores.find(
    (s) => s.agencySlug === input.agencySlug && s.storeSlug === input.storeSlug,
  );
  if (!match?.storeId) {
    return Response.json({ error: "Tienda no encontrada o sin acceso." }, { status: 403 });
  }

  const membershipRoles = [match.effectiveRole];
  if (!can(membershipRoles, "integrations.manage")) {
    return Response.json({ error: "No tienes permiso para conectar integraciones." }, { status: 403 });
  }

  let shop: string;
  try {
    shop = assertShopifyShopDomain(input.shopRaw);
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : "Dominio Shopify inválido." },
      { status: 400 },
    );
  }

  const state = createShopifyOAuthState({
    agencyId: match.agencyId,
    storeId: match.storeId,
    userId: user.id,
    shop,
    agencySlug: input.agencySlug,
    storeSlug: input.storeSlug,
  });

  const authorizeUrl = buildShopifyAuthorizeUrl(shop, state);
  return Response.redirect(authorizeUrl, 302);
}

export function shopifyIntegrationsReturnUrl(
  agencySlug: string,
  storeSlug: string,
  query?: Record<string, string>,
): string {
  const path = routes.store.integrationDetail(agencySlug, storeSlug, "shopify");
  if (!query || !Object.keys(query).length) return path;
  const params = new URLSearchParams(query);
  return `${path}?${params.toString()}`;
}
