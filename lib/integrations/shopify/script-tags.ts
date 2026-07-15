import "server-only";

import { getShopifyEnv } from "@/lib/integrations/shopify/env";
import { shopifyAdminGraphql } from "@/lib/integrations/shopify/graphql";

export type ShopifyScriptTagRegistrationResult = {
  ok: boolean;
  id?: string;
  src: string;
  skipped?: boolean;
  error?: string;
};

export type ShopifyScriptTagUnregisterResult = {
  id: string;
  ok: boolean;
  error?: string;
};

type ListScriptTagsResult = {
  scriptTags?: {
    edges: Array<{
      node: { id: string; src: string; displayScope?: string | null };
    }>;
  };
};

type CreateScriptTagResult = {
  scriptTagCreate?: {
    scriptTag?: { id: string; src: string } | null;
    userErrors?: Array<{ field?: string[] | null; message: string }>;
  };
};

type DeleteScriptTagResult = {
  scriptTagDelete?: {
    deletedScriptTagId?: string | null;
    userErrors?: Array<{ field?: string[] | null; message: string }>;
  };
};

function normalizeUrl(url: string): string {
  return url.replace(/\/$/, "").split("?")[0] ?? url;
}

/** Public storefront attribution script hosted by CODTracked. */
export function shopifyAttributionScriptSrc(appUrl?: string): string {
  const base = (appUrl ?? getShopifyEnv().appUrl).replace(/\/$/, "");
  return `${base}/shopify/codtracked-attribution.js`;
}

/**
 * Install CODTracked attribution ScriptTag on the Online Store (via content_for_header).
 * Soft-idempotent: skips create when the same src already exists.
 *
 * Requires OAuth scope `write_script_tags`. Merchant must re-authorize after scope change.
 * Note: App Store apps should prefer Theme App Extensions long-term; ScriptTag works for
 * custom/dev installs and still injects on themes that include {{ content_for_header }}.
 */
export async function registerShopifyAttributionScriptTag(
  shop: string,
  accessToken: string,
): Promise<ShopifyScriptTagRegistrationResult> {
  const src = shopifyAttributionScriptSrc();
  const existing = await shopifyAdminGraphql<ListScriptTagsResult>(
    shop,
    accessToken,
    `#graphql
      query ListScriptTags($first: Int!) {
        scriptTags(first: $first) {
          edges {
            node {
              id
              src
              displayScope
            }
          }
        }
      }
    `,
    { first: 50 },
  );

  const already = (existing.scriptTags?.edges ?? []).find(
    (edge) => normalizeUrl(edge.node.src) === normalizeUrl(src),
  );
  if (already) {
    return { ok: true, id: already.node.id, src, skipped: true };
  }

  try {
    const created = await shopifyAdminGraphql<CreateScriptTagResult>(
      shop,
      accessToken,
      `#graphql
        mutation ScriptTagCreate($input: ScriptTagInput!) {
          scriptTagCreate(input: $input) {
            scriptTag {
              id
              src
            }
            userErrors {
              field
              message
            }
          }
        }
      `,
      {
        input: {
          src,
          displayScope: "ONLINE_STORE",
          cache: true,
        },
      },
    );
    const payload = created.scriptTagCreate;
    const errors = payload?.userErrors?.filter((e) => e.message) ?? [];
    if (errors.length || !payload?.scriptTag?.id) {
      return {
        ok: false,
        src,
        error: errors.map((e) => e.message).join("; ") || "No se creó el ScriptTag.",
      };
    }
    return { ok: true, id: payload.scriptTag.id, src };
  } catch (err) {
    return {
      ok: false,
      src,
      error: err instanceof Error ? err.message : "Error al registrar ScriptTag",
    };
  }
}

/** Delete CODTracked attribution ScriptTags that point at this app's hosted JS. */
export async function unregisterShopifyAttributionScriptTag(
  shop: string,
  accessToken: string,
): Promise<{ src: string; results: ShopifyScriptTagUnregisterResult[] }> {
  const src = shopifyAttributionScriptSrc();
  const existing = await shopifyAdminGraphql<ListScriptTagsResult>(
    shop,
    accessToken,
    `#graphql
      query ListScriptTags($first: Int!) {
        scriptTags(first: $first) {
          edges {
            node {
              id
              src
            }
          }
        }
      }
    `,
    { first: 50 },
  );

  const targets = (existing.scriptTags?.edges ?? []).filter(
    (edge) => normalizeUrl(edge.node.src) === normalizeUrl(src),
  );
  const results: ShopifyScriptTagUnregisterResult[] = [];

  for (const edge of targets) {
    try {
      const deleted = await shopifyAdminGraphql<DeleteScriptTagResult>(
        shop,
        accessToken,
        `#graphql
          mutation ScriptTagDelete($id: ID!) {
            scriptTagDelete(id: $id) {
              deletedScriptTagId
              userErrors {
                field
                message
              }
            }
          }
        `,
        { id: edge.node.id },
      );
      const payload = deleted.scriptTagDelete;
      const errors = payload?.userErrors?.filter((e) => e.message) ?? [];
      if (errors.length || !payload?.deletedScriptTagId) {
        results.push({
          id: edge.node.id,
          ok: false,
          error: errors.map((e) => e.message).join("; ") || "No se eliminó el ScriptTag.",
        });
        continue;
      }
      results.push({ id: edge.node.id, ok: true });
    } catch (err) {
      results.push({
        id: edge.node.id,
        ok: false,
        error: err instanceof Error ? err.message : "Error al eliminar ScriptTag",
      });
    }
  }

  return { src, results };
}
