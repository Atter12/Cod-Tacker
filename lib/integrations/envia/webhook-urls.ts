export type EnviaWebhookUrls = {
  /** Single URL — resolve via tracking / Bearer fingerprint / demo env. */
  global: string;
  /** Per-store URL — agencySlug/storeSlug pins the tenant. */
  store: string;
};

/** Build copy-paste URLs for the Envia dashboard. */
export function buildEnviaWebhookUrls(
  agencySlug: string,
  storeSlug: string,
  appBaseUrl: string,
): EnviaWebhookUrls {
  const base = appBaseUrl.replace(/\/$/, "");
  const agency = encodeURIComponent(agencySlug.trim());
  const store = encodeURIComponent(storeSlug.trim());
  return {
    global: `${base}/api/webhooks/envia`,
    store: `${base}/api/webhooks/envia/${agency}/${store}`,
  };
}
