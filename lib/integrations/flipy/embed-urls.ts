export type FlipyLocationEmbedParams = {
  embedOrigin: string;
  token: string;
  prefillAddress?: string | null;
  prefillLat?: number | null;
  prefillLng?: number | null;
};

export function normalizeFlipyEmbedOrigin(origin: string): string {
  return origin.replace(/\/$/, "");
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
