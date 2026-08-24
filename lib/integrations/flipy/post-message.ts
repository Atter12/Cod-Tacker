/** Contrato postMessage embed Flipy ↔ COD-tracked (F2 + F3). */

export const FLIPY_MESSAGE_TYPES = {
  LOCATION_CONFIRMED: "flipy-location-confirmed",
  LOCATION_ERROR: "flipy-location-error",
  WALLET_TOPPED_UP: "flipy-wallet-topped-up",
  WALLET_ERROR: "flipy-wallet-error",
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
  const address = typeof msg.address === "string" ? msg.address.trim() : "";
  if (!address || !Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return {
    type: FLIPY_MESSAGE_TYPES.LOCATION_CONFIRMED,
    address,
    lat,
    lng,
  };
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
