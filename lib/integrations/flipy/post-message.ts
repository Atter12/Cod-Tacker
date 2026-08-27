/** Contrato postMessage embed Flipy ↔ COD-tracked (F2 + F3 + F4). */

export const FLIPY_MESSAGE_TYPES = {
  LOCATION_CONFIRMED: "flipy-location-confirmed",
  LOCATION_UPDATED: "flipy-location-updated",
  LOCATION_ERROR: "flipy-location-error",
  WALLET_TOPPED_UP: "flipy-wallet-topped-up",
  WALLET_ERROR: "flipy-wallet-error",
  BIDS_UPDATED: "flipy-bids-updated",
  BID_ACCEPTED: "flipy-bid-accepted",
  BID_REJECTED: "flipy-bid-rejected",
  BIDS_ERROR: "flipy-bids-error",
} as const;

export type FlipyLocationConfirmedMessage = {
  type: typeof FLIPY_MESSAGE_TYPES.LOCATION_CONFIRMED | typeof FLIPY_MESSAGE_TYPES.LOCATION_UPDATED;
  address: string;
  lat: number;
  lng: number;
  /** true when this is a live pin drag (not final confirm). */
  provisional?: boolean;
};

export type FlipyLocationErrorMessage = {
  type: typeof FLIPY_MESSAGE_TYPES.LOCATION_ERROR;
  code: string;
  message: string;
};

const LOCATION_TYPES = new Set([
  FLIPY_MESSAGE_TYPES.LOCATION_CONFIRMED,
  FLIPY_MESSAGE_TYPES.LOCATION_UPDATED,
  "location-confirmed",
  "location-updated",
  "flipy_location_confirmed",
  "flipy_location_updated",
]);

function readLocationCoords(msg: Record<string, unknown>): { lat: number; lng: number } | null {
  const nested =
    msg.payload && typeof msg.payload === "object" && !Array.isArray(msg.payload)
      ? (msg.payload as Record<string, unknown>)
      : msg.location && typeof msg.location === "object" && !Array.isArray(msg.location)
        ? (msg.location as Record<string, unknown>)
        : msg.coords && typeof msg.coords === "object" && !Array.isArray(msg.coords)
          ? (msg.coords as Record<string, unknown>)
          : msg;
  const lat = Number(nested.lat ?? nested.latitude);
  const lng = Number(nested.lng ?? nested.longitude ?? nested.lon ?? nested.long);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
  return { lat, lng };
}

function readLocationAddress(msg: Record<string, unknown>): string {
  const nested =
    msg.payload && typeof msg.payload === "object" && !Array.isArray(msg.payload)
      ? (msg.payload as Record<string, unknown>)
      : msg;
  for (const key of ["address", "direccion", "formattedAddress", "formatted_address", "label"]) {
    const value = nested[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "";
}

export function parseFlipyLocationMessage(data: unknown): FlipyLocationConfirmedMessage | null {
  if (typeof data === "string") {
    try {
      return parseFlipyLocationMessage(JSON.parse(data) as unknown);
    } catch {
      return null;
    }
  }
  if (!data || typeof data !== "object") return null;
  const msg = data as Record<string, unknown>;
  const typeRaw = typeof msg.type === "string" ? msg.type.trim() : "";
  if (!typeRaw || !LOCATION_TYPES.has(typeRaw)) return null;
  const coords = readLocationCoords(msg);
  if (!coords) return null;
  const provisional =
    typeRaw === FLIPY_MESSAGE_TYPES.LOCATION_UPDATED ||
    typeRaw === "location-updated" ||
    typeRaw === "flipy_location_updated" ||
    msg.provisional === true;
  return {
    type: provisional
      ? FLIPY_MESSAGE_TYPES.LOCATION_UPDATED
      : FLIPY_MESSAGE_TYPES.LOCATION_CONFIRMED,
    address: readLocationAddress(msg),
    lat: coords.lat,
    lng: coords.lng,
    provisional,
  };
}

export type FlipyBidsUpdatedMessage = {
  type: typeof FLIPY_MESSAGE_TYPES.BIDS_UPDATED;
  envioId?: string;
  count?: number;
};

export type FlipyBidAcceptedMessage = {
  type: typeof FLIPY_MESSAGE_TYPES.BID_ACCEPTED;
  envioId?: string;
  bidId?: string;
};

export type FlipyBidRejectedMessage = {
  type: typeof FLIPY_MESSAGE_TYPES.BID_REJECTED;
  envioId?: string;
  bidId?: string;
  ofertaId?: string;
  bidsRemaining?: number;
};

export type FlipyBidsErrorMessage = {
  type: typeof FLIPY_MESSAGE_TYPES.BIDS_ERROR;
  code: string;
  message: string;
};

function parseBidsEnvelope(data: unknown): Record<string, unknown> | null {
  if (typeof data === "string") {
    try {
      return parseBidsEnvelope(JSON.parse(data) as unknown);
    } catch {
      return null;
    }
  }
  if (!data || typeof data !== "object") return null;
  return data as Record<string, unknown>;
}

export function parseFlipyBidsUpdatedMessage(data: unknown): FlipyBidsUpdatedMessage | null {
  const msg = parseBidsEnvelope(data);
  if (!msg || msg.type !== FLIPY_MESSAGE_TYPES.BIDS_UPDATED) return null;
  const count = msg.count != null ? Number(msg.count) : undefined;
  return {
    type: FLIPY_MESSAGE_TYPES.BIDS_UPDATED,
    envioId: typeof msg.envioId === "string" ? msg.envioId : undefined,
    count: count != null && Number.isFinite(count) ? count : undefined,
  };
}

export function parseFlipyBidAcceptedMessage(data: unknown): FlipyBidAcceptedMessage | null {
  const msg = parseBidsEnvelope(data);
  if (!msg || msg.type !== FLIPY_MESSAGE_TYPES.BID_ACCEPTED) return null;
  return {
    type: FLIPY_MESSAGE_TYPES.BID_ACCEPTED,
    envioId: typeof msg.envioId === "string" ? msg.envioId : undefined,
    bidId: typeof msg.bidId === "string" ? msg.bidId : undefined,
  };
}

export function parseFlipyBidRejectedMessage(data: unknown): FlipyBidRejectedMessage | null {
  const msg = parseBidsEnvelope(data);
  if (!msg || msg.type !== FLIPY_MESSAGE_TYPES.BID_REJECTED) return null;
  const remainingRaw = msg.bidsRemaining ?? msg.bids_remaining ?? msg.pujasRestantes;
  const remaining = remainingRaw != null ? Number(remainingRaw) : undefined;
  const ofertaId =
    typeof msg.ofertaId === "string"
      ? msg.ofertaId
      : typeof msg.oferta_id === "string"
        ? msg.oferta_id
        : undefined;
  const bidId = typeof msg.bidId === "string" ? msg.bidId : ofertaId;
  return {
    type: FLIPY_MESSAGE_TYPES.BID_REJECTED,
    envioId: typeof msg.envioId === "string" ? msg.envioId : undefined,
    bidId,
    ofertaId: ofertaId ?? bidId,
    bidsRemaining: remaining != null && Number.isFinite(remaining) ? remaining : undefined,
  };
}

export function parseFlipyBidsErrorMessage(data: unknown): FlipyBidsErrorMessage | null {
  const msg = parseBidsEnvelope(data);
  if (!msg || msg.type !== FLIPY_MESSAGE_TYPES.BIDS_ERROR) return null;
  const message = typeof msg.message === "string" ? msg.message.trim() : "";
  const code = typeof msg.code === "string" ? msg.code.trim() : "BIDS_ERROR";
  if (!message) return null;
  return { type: FLIPY_MESSAGE_TYPES.BIDS_ERROR, code, message };
}

export type FlipyWalletToppedUpMessage = {
  type: typeof FLIPY_MESSAGE_TYPES.WALLET_TOPPED_UP;
  newBalance: number;
};

export function parseFlipyWalletToppedUpMessage(data: unknown): FlipyWalletToppedUpMessage | null {
  if (typeof data === "string") {
    try {
      return parseFlipyWalletToppedUpMessage(JSON.parse(data) as unknown);
    } catch {
      return null;
    }
  }
  if (!data || typeof data !== "object") return null;
  const msg = data as Record<string, unknown>;
  if (msg.type !== FLIPY_MESSAGE_TYPES.WALLET_TOPPED_UP) return null;
  const newBalance = Number(msg.newBalance ?? msg.new_balance);
  if (!Number.isFinite(newBalance)) return null;
  return {
    type: FLIPY_MESSAGE_TYPES.WALLET_TOPPED_UP,
    newBalance,
  };
}

export type FlipyWalletErrorMessage = {
  type: typeof FLIPY_MESSAGE_TYPES.WALLET_ERROR;
  code: string;
  message: string;
};

export function parseFlipyWalletErrorMessage(data: unknown): FlipyWalletErrorMessage | null {
  if (typeof data === "string") {
    try {
      return parseFlipyWalletErrorMessage(JSON.parse(data) as unknown);
    } catch {
      return null;
    }
  }
  if (!data || typeof data !== "object") return null;
  const msg = data as Record<string, unknown>;
  if (msg.type !== FLIPY_MESSAGE_TYPES.WALLET_ERROR) return null;
  const message = typeof msg.message === "string" ? msg.message.trim() : "";
  const code = typeof msg.code === "string" ? msg.code.trim() : "WALLET_ERROR";
  if (!message) return null;
  return { type: FLIPY_MESSAGE_TYPES.WALLET_ERROR, code, message };
}

export function isAllowedFlipyEmbedOrigin(origin: string, allowedOrigins: string[]): boolean {
  const normalized = allowedOrigins.map((entry) => entry.trim()).filter(Boolean);
  if (!normalized.length) return false;
  return normalized.some((entry) => origin === entry || origin.startsWith(entry));
}
