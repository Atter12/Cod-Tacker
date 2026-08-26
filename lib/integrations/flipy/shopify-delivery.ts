import {
  evaluateDestinationConsistency,
  inferCountryFromAddressText,
  inferCountryFromCoords,
  isWeakLocationAddress,
} from "@/lib/integrations/flipy/destination-consistency";
import type { FlipyRoutePoint } from "@/lib/integrations/flipy/route-address";

export const FLIPY_DELIVERY_COUNTRY = "PE";

export function normalizeShippingCountryCode(
  countryCode: string | null | undefined,
): string | null {
  if (!countryCode?.trim()) return null;
  return countryCode.trim().toUpperCase();
}

export function isPeruShippingCountry(countryCode: string | null | undefined): boolean {
  const normalized = normalizeShippingCountryCode(countryCode);
  return normalized === "PE" || normalized === "PER";
}

export function isOutsideFlipyDeliveryCountry(
  countryCode: string | null | undefined,
): boolean {
  const normalized = normalizeShippingCountryCode(countryCode);
  return Boolean(normalized && !isPeruShippingCountry(normalized));
}

/** Shopify sample / default checkout addresses that must not auto-trust for Flipy (PE-only). */
export function isLikelyShopifySampleAddress(input: {
  address1?: string | null;
  city?: string | null;
  region?: string | null;
  countryCode?: string | null;
}): boolean {
  if (isOutsideFlipyDeliveryCountry(input.countryCode)) return true;
  const city = (input.city ?? "").trim().toLowerCase();
  const region = (input.region ?? "").trim().toLowerCase();
  return city.includes("sitka") && region.includes("alaska");
}

export type ResolveShopifyDeliveryInput = {
  prefillAddress: string;
  prefillCoords?: { lat: number; lng: number } | null;
  shippingCountryCode?: string | null;
  shippingAddress1?: string | null;
  shippingCity?: string | null;
  shippingRegion?: string | null;
  customerName?: string | null;
  customerPhone?: string | null;
  customerEmail?: string | null;
};

export type ResolveShopifyDeliveryResult = {
  point: FlipyRoutePoint;
  autoConfirmed: boolean;
  needsGeocode: boolean;
  requiresMap: boolean;
  hint: string | null;
};

function buildContactFields(input: ResolveShopifyDeliveryInput) {
  return {
    contactName: input.customerName?.trim() ?? "",
    contactPhone: input.customerPhone?.trim() ?? "",
    contactEmail: input.customerEmail?.trim() ?? "",
  };
}

function hasValidCoords(coords?: { lat: number; lng: number } | null): coords is {
  lat: number;
  lng: number;
} {
  return (
    coords != null &&
    Number.isFinite(coords.lat) &&
    Number.isFinite(coords.lng)
  );
}

function isPeruDeliverableAddress(input: ResolveShopifyDeliveryInput): boolean {
  if (isPeruShippingCountry(input.shippingCountryCode)) return true;
  const address = input.prefillAddress.trim();
  if (!address || isWeakLocationAddress(address)) return false;
  return inferCountryFromAddressText(address) === FLIPY_DELIVERY_COUNTRY;
}

export function resolveShopifyDeliveryPoint(
  input: ResolveShopifyDeliveryInput,
): ResolveShopifyDeliveryResult {
  const address = input.prefillAddress.trim();
  const contacts = buildContactFields(input);
  const emptyPoint: FlipyRoutePoint = {
    address,
    lat: NaN,
    lng: NaN,
    ...contacts,
    pinConfirmed: false,
  };

  if (
    isLikelyShopifySampleAddress({
      address1: input.shippingAddress1,
      city: input.shippingCity,
      region: input.shippingRegion,
      countryCode: input.shippingCountryCode,
    })
  ) {
    return {
      point: emptyPoint,
      autoConfirmed: false,
      needsGeocode: false,
      requiresMap: true,
      hint:
        "La dirección de Shopify no es de Perú (ej. dirección de prueba). Confirma la entrega en el mapa.",
    };
  }

  if (!address || isWeakLocationAddress(address)) {
    return {
      point: emptyPoint,
      autoConfirmed: false,
      needsGeocode: false,
      requiresMap: true,
      hint: address
        ? "La dirección de Shopify es muy genérica. Confirma la entrega en el mapa."
        : "No hay dirección de envío en Shopify. Confirma la entrega en el mapa.",
    };
  }

  if (!isPeruDeliverableAddress(input)) {
    return {
      point: emptyPoint,
      autoConfirmed: false,
      needsGeocode: false,
      requiresMap: true,
      hint: "La dirección de Shopify no parece ser de Perú. Confirma la entrega en el mapa.",
    };
  }

  if (hasValidCoords(input.prefillCoords)) {
    const pinCountry = inferCountryFromCoords(
      input.prefillCoords.lat,
      input.prefillCoords.lng,
    );
    if (pinCountry === FLIPY_DELIVERY_COUNTRY) {
      const consistency = evaluateDestinationConsistency({
        address,
        lat: input.prefillCoords.lat,
        lng: input.prefillCoords.lng,
        prefillAddress: address,
        prefillCoords: input.prefillCoords,
      });
      if (consistency.ok) {
        return {
          point: {
            address,
            lat: input.prefillCoords.lat,
            lng: input.prefillCoords.lng,
            ...contacts,
            pinConfirmed: true,
          },
          autoConfirmed: true,
          needsGeocode: false,
          requiresMap: false,
          hint: "Usamos la dirección de Shopify para la entrega.",
        };
      }
    }
  }

  return {
    point: emptyPoint,
    autoConfirmed: false,
    needsGeocode: true,
    requiresMap: false,
    hint: null,
  };
}

export function applyGeocodedShopifyDelivery(input: {
  point: FlipyRoutePoint;
  geocoded: { address: string; lat: number; lng: number };
  prefillAddress: string;
}): ResolveShopifyDeliveryResult | null {
  const pinCountry = inferCountryFromCoords(input.geocoded.lat, input.geocoded.lng);
  if (pinCountry !== FLIPY_DELIVERY_COUNTRY) return null;

  const consistency = evaluateDestinationConsistency({
    address: input.geocoded.address,
    lat: input.geocoded.lat,
    lng: input.geocoded.lng,
    prefillAddress: input.prefillAddress,
  });
  if (!consistency.ok) return null;

  return {
    point: {
      ...input.point,
      address: input.geocoded.address,
      lat: input.geocoded.lat,
      lng: input.geocoded.lng,
      pinConfirmed: true,
    },
    autoConfirmed: true,
    needsGeocode: false,
    requiresMap: false,
    hint: "Geocodificamos la dirección de Shopify para la entrega.",
  };
}
