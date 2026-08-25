export type FlipyLocationEmbedParams = {
  embedOrigin: string;
  token: string;
  prefillAddress?: string | null;
  prefillLat?: number | null;
  prefillLng?: number | null;
};

/** Prod partner embed host (web-app on Vercel). Not tienda.flipyexpress.com. */
export const FLIPY_DEFAULT_EMBED_ORIGIN = "https://flipy-panel.vercel.app";

/** Prod tienda app (pujas / envíos). Not used for partner iframes. */
export const FLIPY_DEFAULT_APP_ORIGIN = "https://tienda.flipyexpress.com";

export function normalizeFlipyEmbedOrigin(origin: string): string {
  return origin.replace(/\/$/, "");
}

export type FlipyEmbedScope = "location_picker" | "wallet_topup" | "bids_panel";

const FLIPY_EMBED_PATH_BY_SCOPE: Record<FlipyEmbedScope, string> = {
  location_picker: "/partner/ubicacion",
  wallet_topup: "/partner/recarga",
  bids_panel: "/partner/pujas",
};

export function originsMatchFlipyHost(a: string, b: string): boolean {
  try {
    return (
      new URL(normalizeFlipyEmbedOrigin(a)).origin ===
      new URL(normalizeFlipyEmbedOrigin(b)).origin
    );
  } catch {
    return false;
  }
}

export function assertFlipyEmbedPath(url: string, expectedPath: string): string {
  const parsed = new URL(url);
  if (!parsed.pathname.includes(expectedPath)) {
    throw new Error(
      `URL embed Flipy inválida (${parsed.pathname}); se esperaba ruta ${expectedPath}.`,
    );
  }
  return url;
}

/**
 * If Partner API returns a partner path on the tienda app host, rewrite to
 * FLIPY_EMBED_ORIGIN (web-app panel) keeping path + query (token).
 */
export function rewriteFlipyEmbedAwayFromTiendaApp(input: {
  url: string;
  embedOrigin: string;
  appOrigin: string;
}): string {
  if (!originsMatchFlipyHost(input.url, input.appOrigin)) return input.url;
  if (originsMatchFlipyHost(input.embedOrigin, input.appOrigin)) {
    throw new Error(
      `FLIPY_EMBED_ORIGIN no puede ser la app tienda (${input.appOrigin}). ` +
        `Configura FLIPY_EMBED_ORIGIN=https://flipy-panel.vercel.app en Vercel.`,
    );
  }
  const parsed = new URL(input.url);
  const base = normalizeFlipyEmbedOrigin(input.embedOrigin);
  return `${base}${parsed.pathname}${parsed.search}${parsed.hash}`;
}

/** Prefer scoped URL from Partner API; rewrite tienda-host embeds to panel host. */
export function resolveFlipyScopedEmbedUrl(input: {
  scope: FlipyEmbedScope;
  apiEmbedUrl?: string | null;
  embedOrigin: string;
  appOrigin: string;
  buildFallback: () => string;
}): string {
  const expectedPath = FLIPY_EMBED_PATH_BY_SCOPE[input.scope];
  const apiUrl = input.apiEmbedUrl?.trim();
  if (apiUrl) {
    const withPath = assertFlipyEmbedPath(apiUrl, expectedPath);
    const rewritten = rewriteFlipyEmbedAwayFromTiendaApp({
      url: withPath,
      embedOrigin: input.embedOrigin,
      appOrigin: input.appOrigin,
    });
    return assertFlipyEmbedPath(rewritten, expectedPath);
  }

  if (originsMatchFlipyHost(input.embedOrigin, input.appOrigin)) {
    throw new Error(
      `FLIPY_EMBED_ORIGIN no puede ser la app tienda (${input.appOrigin}). ` +
        `Los embeds partner viven en el web-app de Flipy (${expectedPath}). ` +
        `Configura FLIPY_EMBED_ORIGIN=https://flipy-panel.vercel.app en Vercel.`,
    );
  }

  return assertFlipyEmbedPath(input.buildFallback(), expectedPath);
}

export function buildFlipyLocationEmbedUrl(input: FlipyLocationEmbedParams): string {
  const base = normalizeFlipyEmbedOrigin(input.embedOrigin);
  const url = new URL(`${base}/partner/ubicacion`);
  url.searchParams.set("token", input.token);
  if (input.prefillAddress?.trim()) {
    url.searchParams.set("prefillAddress", input.prefillAddress.trim());
  }
  if (input.prefillLat != null && Number.isFinite(input.prefillLat)) {
    url.searchParams.set("lat", String(input.prefillLat));
  }
  if (input.prefillLng != null && Number.isFinite(input.prefillLng)) {
    url.searchParams.set("lng", String(input.prefillLng));
  }
  return url.toString();
}

export function isAllowedFlipyPostMessageOrigin(origin: string, embedOrigin: string): boolean {
  try {
    return new URL(origin).origin === new URL(normalizeFlipyEmbedOrigin(embedOrigin)).origin;
  } catch {
    return false;
  }
}

export type FlipyWalletEmbedParams = {
  embedOrigin: string;
  token: string;
};

export function buildFlipyWalletEmbedUrl(input: FlipyWalletEmbedParams): string {
  const base = normalizeFlipyEmbedOrigin(input.embedOrigin);
  const url = new URL(`${base}/partner/recarga`);
  url.searchParams.set("token", input.token);
  return url.toString();
}

export type FlipyBidsEmbedParams = {
  embedOrigin: string;
  token: string;
  envioId?: string | null;
};

/** F4-03 — embed evaluación panel pujas (read-only summary). */
export function buildFlipyBidsEmbedUrl(input: FlipyBidsEmbedParams): string {
  const base = normalizeFlipyEmbedOrigin(input.embedOrigin);
  const url = new URL(`${base}/partner/pujas`);
  url.searchParams.set("token", input.token);
  if (input.envioId?.trim()) {
    url.searchParams.set("envioId", input.envioId.trim());
  }
  return url.toString();
}

/** Rastreo cliente (loop público /rastreo) — no usar para pujas tienda. */
export function buildFlipyCustomerTrackingUrl(trackingUrl?: string | null): string | null {
  const url = trackingUrl?.trim();
  return url || null;
}

/** Web URL operación tienda (pujas / detalle envío). */
export function buildFlipyOperationWebUrl(input: {
  appOrigin: string;
  envioId?: string | null;
  appWebUrl?: string | null;
}): string {
  if (input.appWebUrl?.trim()) return input.appWebUrl.trim();
  const base = normalizeFlipyEmbedOrigin(input.appOrigin);
  if (input.envioId?.trim()) {
    return `${base}/envios/${encodeURIComponent(input.envioId.trim())}`;
  }
  return `${base}/pujas`;
}

/** Deep link nativo app tienda (flipytienda://). */
export function buildFlipyOperationDeepLinkNative(input: {
  envioId?: string | null;
  appDeepLink?: string | null;
  pujasDeepLink?: string | null;
}): string | null {
  if (input.appDeepLink?.trim()) return input.appDeepLink.trim();
  if (input.envioId?.trim()) {
    return `flipytienda://envios/${encodeURIComponent(input.envioId.trim())}`;
  }
  if (input.pujasDeepLink?.trim()) return input.pujasDeepLink.trim();
  return "flipytienda://pujas";
}

/** @deprecated Usar buildFlipyCustomerTrackingUrl o buildFlipyOperationWebUrl */
export function buildFlipyAppDeepLink(input: {
  embedOrigin: string;
  trackingUrl?: string | null;
  envioId?: string | null;
}): string | null {
  return buildFlipyOperationWebUrl({
    appOrigin: input.embedOrigin,
    envioId: input.envioId,
  });
}

/** Deep link operación Flipy (pujas / envío) — F3-03 */
export function buildFlipyOperationDeepLink(input: {
  appOrigin: string;
  envioId?: string | null;
  appWebUrl?: string | null;
}): string {
  return buildFlipyOperationWebUrl(input);
}
