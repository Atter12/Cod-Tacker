import type { FlipyAutoCreateMinConfidence } from "@/lib/integrations/flipy/settings";
import { buildPrefillShippingAddress } from "@/lib/integrations/flipy/destination-consistency";
import type {
  FlipyEscenarioPago,
  FlipyPaymentResolution,
} from "@/lib/integrations/flipy/resolve-payment";

export type FlipyAutoCreateSkipReason =
  | "disabled"
  | "pickup"
  | "existing_envio"
  | "low_confidence"
  | "requires_confirmation"
  | "no_escenario"
  | "no_destination"
  | "geocode_failed";

export type FlipyAutoCreateEvaluation = {
  eligible: boolean;
  escenarioPago: FlipyEscenarioPago | null;
  skipReason: FlipyAutoCreateSkipReason | null;
  reasons: string[];
};

const CONFIDENCE_RANK: Record<FlipyPaymentResolution["confidence"], number> = {
  high: 3,
  medium: 2,
  low: 1,
};

export function buildOrderShippingAddress(order: {
  shipping_district: string | null;
  shipping_city: string | null;
  shipping_region: string | null;
  shipping_country_code: string | null;
  shipping_postal_code: string | null;
  shippingAddress1?: string | null;
}): string {
  return buildPrefillShippingAddress({
    address1: order.shippingAddress1,
    district: order.shipping_district,
    city: order.shipping_city,
    region: order.shipping_region,
    countryCode: order.shipping_country_code,
    postalCode: order.shipping_postal_code,
  });
}

export function readOrderDestinationCoords(order: {
  shipping_latitude: number | null;
  shipping_longitude: number | null;
}): { lat: number; lng: number } | null {
  const lat = order.shipping_latitude;
  const lng = order.shipping_longitude;
  if (typeof lat !== "number" || typeof lng !== "number") return null;
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
  return { lat, lng };
}

export function evaluateFlipyAutoCreate(input: {
  enabled: boolean;
  minConfidence: FlipyAutoCreateMinConfidence;
  flipyEnvioId: string | null;
  payment: FlipyPaymentResolution;
  destinationCoords: { lat: number; lng: number } | null;
  destinationAddress: string;
}): FlipyAutoCreateEvaluation {
  const reasons: string[] = [];

  if (!input.enabled) {
    return { eligible: false, escenarioPago: null, skipReason: "disabled", reasons: ["Auto-create desactivado"] };
  }

  if (input.flipyEnvioId) {
    return {
      eligible: false,
      escenarioPago: null,
      skipReason: "existing_envio",
      reasons: ["Pedido ya tiene envío Flipy"],
    };
  }

  if (input.payment.fulfillmentMode === "pickup") {
    return {
      eligible: false,
      escenarioPago: null,
      skipReason: "pickup",
      reasons: ["Pedido de recojo en tienda"],
    };
  }

  const minRank = CONFIDENCE_RANK[input.minConfidence === "medium" ? "medium" : "high"];
  if (CONFIDENCE_RANK[input.payment.confidence] < minRank) {
    reasons.push(`Confianza ${input.payment.confidence} < mínimo ${input.minConfidence}`);
    return {
      eligible: false,
      escenarioPago: null,
      skipReason: "low_confidence",
      reasons,
    };
  }

  if (input.payment.requiresUserConfirmation) {
    reasons.push("Escenario requiere confirmación manual");
    return {
      eligible: false,
      escenarioPago: null,
      skipReason: "requires_confirmation",
      reasons,
    };
  }

  if (!input.payment.suggestedEscenario) {
    return {
      eligible: false,
      escenarioPago: null,
      skipReason: "no_escenario",
      reasons: ["Sin escenario sugerido"],
    };
  }

  if (!input.destinationCoords && !input.destinationAddress.trim()) {
    return {
      eligible: false,
      escenarioPago: null,
      skipReason: "no_destination",
      reasons: ["Sin dirección de envío"],
    };
  }

  reasons.push(...input.payment.reasons);
  return {
    eligible: true,
    escenarioPago: input.payment.suggestedEscenario,
    skipReason: null,
    reasons,
  };
}
