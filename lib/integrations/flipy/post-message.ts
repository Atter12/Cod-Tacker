/** Contrato postMessage embed Flipy ↔ COD-tracked (F2 + F3 + F4). */

export const FLIPY_MESSAGE_TYPES = {
  LOCATION_CONFIRMED: "flipy-location-confirmed",
  LOCATION_ERROR: "flipy-location-error",
  WALLET_TOPPED_UP: "flipy-wallet-topped-up",
  WALLET_ERROR: "flipy-wallet-error",
  BIDS_UPDATED: "flipy-bids-updated",
  BID_ACCEPTED: "flipy-bid-accepted",
  BIDS_ERROR: "flipy-bids-error",
} as const;

export type FlipyLocationConfirmedMessage = {
  type: typeof FLIPY_MESSAGE_TYPES.LOCATION_CONFIRMED;
  address: string;
  lat: number;
  lng: number;
};

export type FlipyLocationErrorMessage = {
  type: typeof FLIPY_MESSAGE_TYPES.LOCATION_ERROR;
  code: string;
  message: string;
};

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
  if (msg.type !== FLIPY_MESSAGE_TYPES.LOCATION_CONFIRMED) return null;
  const lat = Number(msg.lat);
  const lng = Number(msg.lng);
  // Address may be empty when the pin moved but reverse-geocode failed — CT must still receive coords.
  const address = typeof msg.address === "string" ? msg.address.trim() : "";
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
  return {
    type: FLIPY_MESSAGE_TYPES.LOCATION_CONFIRMED,
    address,
    lat,
    lng,
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
