/** Shape of integrations.metadata.webhooks after OAuth register (and disconnect cleanup). */
export type ShopifyWebhooksMetadata = {
  callback_uri?: string;
  registered_at?: string;
  unregistered_at?: string;
  error?: string;
  results?: Array<{
    topic?: string;
    ok?: boolean;
    id?: string;
    error?: string;
  }>;
  unregister_results?: Array<{
    id?: string;
    topic?: string;
    ok?: boolean;
    error?: string;
  }>;
};

export function shopifyWebhookCallbackUri(appUrl: string): string {
  return `${appUrl.replace(/\/$/, "")}/api/integrations/shopify/webhooks`;
}

export function parseShopifyWebhooksMetadata(metadata: unknown): ShopifyWebhooksMetadata | null {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return null;
  const webhooks = (metadata as { webhooks?: unknown }).webhooks;
  if (!webhooks || typeof webhooks !== "object" || Array.isArray(webhooks)) return null;
  return webhooks as ShopifyWebhooksMetadata;
}

export function summarizeShopifyWebhooks(meta: ShopifyWebhooksMetadata | null): {
  status: "ok" | "partial" | "error" | "unknown" | "cleared";
  label: string;
  detail: string | null;
} {
  if (!meta) {
    return { status: "unknown", label: "Sin registro", detail: null };
  }
  if (meta.unregistered_at && !meta.registered_at) {
    return {
      status: "cleared",
      label: "Desregistrados",
      detail: `Limpiados ${new Date(meta.unregistered_at).toLocaleString("es-PE")}`,
    };
  }
  if (meta.error && !meta.results?.length) {
    return { status: "error", label: "Error al registrar", detail: meta.error };
  }
  const results = meta.results ?? [];
  if (!results.length) {
    return {
      status: "unknown",
      label: "Sin detalle",
      detail: meta.registered_at
        ? `Último intento ${new Date(meta.registered_at).toLocaleString("es-PE")}`
        : null,
    };
  }
  const okCount = results.filter((r) => r.ok).length;
  const failCount = results.length - okCount;
  if (failCount === 0) {
    return {
      status: "ok",
      label: `${okCount}/${results.length} activos`,
      detail: meta.registered_at
        ? `Registrados ${new Date(meta.registered_at).toLocaleString("es-PE")}`
        : null,
    };
  }
  if (okCount === 0) {
    return {
      status: "error",
      label: "Registro fallido",
      detail: results.map((r) => r.error).filter(Boolean).join("; ") || null,
    };
  }
  return {
    status: "partial",
    label: `${okCount}/${results.length} activos`,
    detail: results
      .filter((r) => !r.ok)
      .map((r) => `${r.topic}: ${r.error ?? "error"}`)
      .join("; "),
  };
}
