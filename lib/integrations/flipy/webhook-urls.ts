export type FlipyWebhookUrls = {
  store: string;
};

export function buildFlipyWebhookUrl(
  agencySlug: string,
  storeSlug: string,
  appUrl: string,
): string {
  const base = appUrl.replace(/\/$/, "");
  return `${base}/api/webhooks/flipy/${encodeURIComponent(agencySlug)}/${encodeURIComponent(storeSlug)}`;
}

export function buildFlipyWebhookUrls(
  agencySlug: string,
  storeSlug: string,
  appUrl: string,
): FlipyWebhookUrls {
  return {
    store: buildFlipyWebhookUrl(agencySlug, storeSlug, appUrl),
  };
}
