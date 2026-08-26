/** Shared types/helpers for Paso 1 Ruta (Recojo / Entrega cards). */

export type FlipyStoreOriginDefaults = {
  address: string;
  lat: number;
  lng: number;
  contactName: string;
  phone: string;
};

export type FlipyRoutePoint = {
  address: string;
  lat: number;
  lng: number;
  contactName: string;
  contactPhone: string;
  contactEmail?: string;
  pinConfirmed: boolean;
};

export type FlipyRouteCardStatus = "empty" | "partial" | "saved";

export function peMobileDigits(value: string): string {
  return value.replace(/\D/g, "").slice(-9);
}

export function isValidPeMobile(value: string): boolean {
  const digits = peMobileDigits(value);
  return digits.length === 9 && digits.startsWith("9");
}

export function emptyFlipyRoutePoint(): FlipyRoutePoint {
  return {
    address: "",
    lat: NaN,
    lng: NaN,
    contactName: "",
    contactPhone: "",
    contactEmail: "",
    pinConfirmed: false,
  };
}

export function hasFlipyRouteLocation(point: FlipyRoutePoint): boolean {
  return (
    point.pinConfirmed &&
    point.address.trim().length > 0 &&
    Number.isFinite(point.lat) &&
    Number.isFinite(point.lng)
  );
}

export function getFlipyRouteCardStatus(
  point: FlipyRoutePoint,
  options?: { requireEmail?: boolean },
): FlipyRouteCardStatus {
  if (!hasFlipyRouteLocation(point)) return "empty";
  const contactOk =
    point.contactName.trim().length > 0 && isValidPeMobile(point.contactPhone);
  const emailOk = !options?.requireEmail || Boolean(point.contactEmail?.trim());
  if (contactOk && emailOk) return "saved";
  return "partial";
}

export function formatFlipyRouteContactLine(point: FlipyRoutePoint): string | null {
  const name = point.contactName.trim();
  const phone = peMobileDigits(point.contactPhone);
  if (!name && !phone) return null;
  if (name && phone) return `${name} · ${phone}`;
  return name || phone;
}

export function validateFlipyRoutePoint(
  point: FlipyRoutePoint,
  kind: "pickup" | "delivery",
): string | null {
  const who = kind === "pickup" ? "entrega" : "recibe";
  if (!hasFlipyRouteLocation(point)) {
    return kind === "pickup"
      ? "Confirma la dirección de recojo en el mapa."
      : "Confirma la dirección de entrega en el mapa.";
  }
  if (!point.contactName.trim()) return `Indica quién ${who} (nombre).`;
  if (!isValidPeMobile(point.contactPhone)) {
    return `Celular de quién ${who}: 9 dígitos PE (empieza en 9).`;
  }
  return null;
}
