/**
 * Heuristics to catch Shopify prefill address stuck while the pin moved
 * (e.g. "Berlin, DE" text + Lima coords).
 */

export const FLIPY_PIN_MOVE_THRESHOLD_M = 200;

/** Rough country bounding boxes used only for inconsistency warnings. */
const COUNTRY_BBOX: Record<string, { minLat: number; maxLat: number; minLng: number; maxLng: number }> = {
  PE: { minLat: -18.5, maxLat: 0.1, minLng: -81.5, maxLng: -68.5 },
  DE: { minLat: 47.2, maxLat: 55.2, minLng: 5.8, maxLng: 15.1 },
  CL: { minLat: -56.0, maxLat: -17.0, minLng: -76.0, maxLng: -66.0 },
  CO: { minLat: -4.3, maxLat: 13.5, minLng: -79.1, maxLng: -66.8 },
  MX: { minLat: 14.5, maxLat: 32.8, minLng: -118.5, maxLng: -86.5 },
  US: { minLat: 24.5, maxLat: 49.5, minLng: -125.0, maxLng: -66.5 },
  ES: { minLat: 35.9, maxLat: 43.9, minLng: -9.4, maxLng: 3.4 },
};

const COUNTRY_ALIASES: Array<{ code: string; patterns: RegExp[] }> = [
  { code: "PE", patterns: [/\bPE\b/i, /\bPer[uú]\b/i, /\bLima\b/i] },
  { code: "DE", patterns: [/\bDE\b/i, /\bGermany\b/i, /\bDeutschland\b/i, /\bBerlin\b/i] },
  { code: "CL", patterns: [/\bCL\b/i, /\bChile\b/i] },
  { code: "CO", patterns: [/\bCO\b/i, /\bColombia\b/i] },
  { code: "MX", patterns: [/\bMX\b/i, /\bM[eé]xico\b/i] },
  { code: "US", patterns: [/\bUS\b/i, /\bUSA\b/i, /\bUnited States\b/i] },
  { code: "ES", patterns: [/\bES\b/i, /\bSpain\b/i, /\bEspa[nñ]a\b/i] },
];

export function haversineDistanceMeters(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const R = 6371000;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

export function inferCountryFromCoords(lat: number, lng: number): string | null {
  for (const [code, box] of Object.entries(COUNTRY_BBOX)) {
    if (lat >= box.minLat && lat <= box.maxLat && lng >= box.minLng && lng <= box.maxLng) {
      return code;
    }
  }
  return null;
}

export function inferCountryFromAddressText(address: string): string | null {
  const text = address.trim();
  if (!text) return null;
  for (const entry of COUNTRY_ALIASES) {
    if (entry.patterns.some((re) => re.test(text))) return entry.code;
  }
  return null;
}

export function normalizeAddressKey(address: string): string {
  return address
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export type DestinationConsistencyInput = {
  address: string;
  lat: number;
  lng: number;
  /** Shopify / previous prefill text shown in the embed. */
  prefillAddress?: string | null;
  /** Known geocode for the prefill (order shipping coords), if any. */
  prefillCoords?: { lat: number; lng: number } | null;
  pinMoveThresholdM?: number;
};

export type DestinationConsistencyResult = {
  ok: boolean;
  reasons: string[];
  pinCountry: string | null;
  addressCountry: string | null;
  movedFromPrefillM: number | null;
  reusedPrefillText: boolean;
  requiresManualAddress: boolean;
};

export function evaluateDestinationConsistency(
  input: DestinationConsistencyInput,
): DestinationConsistencyResult {
  const reasons: string[] = [];
  const address = input.address.trim();
  const pinCountry = inferCountryFromCoords(input.lat, input.lng);
  const addressCountry = address ? inferCountryFromAddressText(address) : null;
  const threshold = input.pinMoveThresholdM ?? FLIPY_PIN_MOVE_THRESHOLD_M;

  let movedFromPrefillM: number | null = null;
  if (input.prefillCoords) {
    movedFromPrefillM = haversineDistanceMeters(input.prefillCoords, {
      lat: input.lat,
      lng: input.lng,
    });
  }

  const reusedPrefillText = Boolean(
    address &&
      input.prefillAddress?.trim() &&
      normalizeAddressKey(address) === normalizeAddressKey(input.prefillAddress),
  );

  if (!address) {
    reasons.push("address_empty");
  }

  if (pinCountry && addressCountry && pinCountry !== addressCountry) {
    reasons.push(`country_mismatch_${addressCountry}_vs_${pinCountry}`);
  }

  if (
    reusedPrefillText &&
    movedFromPrefillM != null &&
    movedFromPrefillM > threshold
  ) {
    reasons.push(`prefill_reused_after_pin_move_${Math.round(movedFromPrefillM)}m`);
  }

  // Absurd: address claims a country far from pin even without exact bbox hit on both.
  if (addressCountry && pinCountry == null) {
    // Soft: cannot prove coords country; skip.
  }

  const requiresManualAddress = reasons.length > 0;
  return {
    ok: !requiresManualAddress,
    reasons,
    pinCountry,
    addressCountry,
    movedFromPrefillM,
    reusedPrefillText,
    requiresManualAddress,
  };
}

export function formatCoordsLabel(lat: number, lng: number): string {
  return `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
}

export function buildPrefillShippingAddress(input: {
  address1?: string | null;
  district?: string | null;
  city?: string | null;
  region?: string | null;
  countryCode?: string | null;
  postalCode?: string | null;
}): string {
  return [
    input.address1,
    input.district,
    input.city,
    input.region,
    input.countryCode,
    input.postalCode,
  ]
    .map((part) => (typeof part === "string" ? part.trim() : ""))
    .filter(Boolean)
    .join(", ");
}
