/**
 * Partner API contract helpers (v0.2.0).
 * Canonical doc: docs/FLIPY_CODTRACKED_ALIGNMENT_V0.2.md · docs/PARTNER_CODTRACKED.md
 * Keep in sync with flipy/docs/PARTNER_CODTRACKED.md
 */

import type { FlipyEscenarioPago } from "@/lib/integrations/flipy/resolve-payment";

export const FLIPY_PARTNER_CONTRACT_VERSION = "0.2.0";

export type FlipyOriginLocation = {
  address: string;
  lat: number;
  lng: number;
};

export type FlipyPackageSize = "pequeno" | "mediano" | "grande";

export type FlipyOperationalFulfillmentMode = "smart" | "bid";

export type FlipyTypeMode = "express" | "programado" | "recurrente";

export type FlipyPackageCareId =
  | "fragil"
  | "vidrio"
  | "liquido"
  | "alimentos"
  | "liviano"
  | "vertical";

/** Required shopifyPayment blob for Partner API v0.2 (§3.3–3.4). */
export type FlipyShopifyPaymentInput = {
  productPaidAtCheckout: boolean;
  shippingPaidAtCheckout: boolean;
  shopifySubtotal: number;
  shopifyShippingAmount: number;
  expectedCodProduct: number;
  expectedCodShipping: number;
  paymentKind: "cod" | "prepaid";
  confirmedEscenario: FlipyEscenarioPago;
  noteAttributes?: Array<{ name?: string | null; value?: string | null } | null>;
};

export type FlipyFleteQuote = {
  version?: number;
  recommendedFare: number;
  marketLow?: number;
  marketHigh?: number;
  minOffer?: number;
  maxOffer?: number;
  distanceKm?: number;
  durationMinutes?: number;
  packageSize?: FlipyPackageSize;
  typeMode?: FlipyTypeMode;
  source?: string;
};

export type FlipyCotizarEnvioInput = {
  originLat: number;
  originLng: number;
  destinationLat: number;
  destinationLng: number;
  packageSize: FlipyPackageSize;
  typeMode?: FlipyTypeMode;
};

export type FlipyCotizarEnvioResult = {
  success: boolean;
  fleteQuote: FlipyFleteQuote;
};

export type FlipyCreateEnvioPartnerInput = {
  externalStoreId: string;
  externalOrderId: string;
  orderNumber?: string | null;
  title?: string | null;
  escenarioPago: FlipyEscenarioPago;
  fulfillmentMode?: FlipyOperationalFulfillmentMode | null;
  priceLocked?: boolean | null;
  codAmount?: number | null;
  price?: number | null;
  originAddress: string;
  originLat: number;
  originLng: number;
  originContact?: string | null;
  originPhone?: string | null;
  destinationAddress: string;
  destinationLat: number;
  destinationLng: number;
  destinationContact?: string | null;
  destinationPhone?: string | null;
  destinationEmail?: string | null;
  packageSize?: FlipyPackageSize | null;
  packageCare?: FlipyPackageCareId[] | null;
  packageCareNote?: string | null;
  typeMode?: FlipyTypeMode | null;
  fleteQuote?: FlipyFleteQuote | null;
  shopifyPayment?: FlipyShopifyPaymentInput | null;
  noteAttributes?: Array<{ name?: string | null; value?: string | null } | null> | null;
};

/** Body accepted by Flipy POST /api/partner/tiendas (required fields). */
export type FlipyProvisionRequestBody = {
  externalStoreId: string;
  nombre: string;
  contactEmail: string;
  originLocation: FlipyOriginLocation;
  direccion?: string;
  telefono?: string;
  contactPhone?: string;
  ruc?: string;
  webhookUrl?: string;
};

export function buildFlipyProvisionRequestBody(input: {
  externalStoreId: string;
  nombre: string;
  contactEmail: string;
  originAddress: string;
  originLat: number;
  originLng: number;
  telefono?: string | null;
  ruc?: string | null;
  webhookUrl?: string | null;
}): FlipyProvisionRequestBody {
  const contactEmail = input.contactEmail.trim();
  if (!contactEmail) {
    throw new Error("contactEmail requerido para provision Flipy");
  }

  const body: FlipyProvisionRequestBody = {
    externalStoreId: input.externalStoreId,
    nombre: input.nombre.trim(),
    contactEmail,
    originLocation: {
      address: input.originAddress.trim(),
      lat: input.originLat,
      lng: input.originLng,
    },
    direccion: input.originAddress.trim(),
  };

  const telefono = input.telefono?.trim();
  if (telefono) {
    body.telefono = telefono;
    body.contactPhone = telefono;
  }

  const ruc = input.ruc?.trim();
  if (ruc) body.ruc = ruc;

  const webhookUrl = input.webhookUrl?.trim();
  if (webhookUrl) body.webhookUrl = webhookUrl;

  return body;
}

/** POST /api/partner/envios/cotizar — v0.2 (§3.2). */
export function buildFlipyCotizarRequestBody(input: FlipyCotizarEnvioInput): Record<string, unknown> {
  return {
    originLat: input.originLat,
    originLng: input.originLng,
    destinationLat: input.destinationLat,
    destinationLng: input.destinationLng,
    packageSize: input.packageSize,
    typeMode: input.typeMode ?? "express",
  };
}

function trimOptional(value: string | null | undefined): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
}

function trimPackageCareNote(value: string | null | undefined): string | undefined {
  const trimmed = trimOptional(value);
  if (!trimmed) return undefined;
  return trimmed.slice(0, 120);
}

/** POST /api/partner/envios — v0.2 body (§3.3–3.4). */
export function buildFlipyCreateEnvioRequestBody(
  input: FlipyCreateEnvioPartnerInput,
): Record<string, unknown> {
  const body: Record<string, unknown> = {
    externalStoreId: input.externalStoreId,
    externalOrderId: input.externalOrderId,
    escenarioPago: input.escenarioPago,
    price: input.price ?? undefined,
    originAddress: input.originAddress.trim(),
    originLat: input.originLat,
    originLng: input.originLng,
    destinationAddress: input.destinationAddress.trim(),
    destinationLat: input.destinationLat,
    destinationLng: input.destinationLng,
    typeMode: input.typeMode ?? "express",
  };

  if (input.packageSize) body.packageSize = input.packageSize;
  if (input.shopifyPayment) body.shopifyPayment = input.shopifyPayment;

  const orderNumber = trimOptional(input.orderNumber);
  if (orderNumber) body.orderNumber = orderNumber;

  const title = trimOptional(input.title);
  if (title) body.title = title;

  if (input.fulfillmentMode) body.fulfillmentMode = input.fulfillmentMode;
  if (input.priceLocked != null) body.priceLocked = input.priceLocked;
  if (input.codAmount != null) body.codAmount = input.codAmount;

  const originContact = trimOptional(input.originContact);
  if (originContact) body.originContact = originContact;
  const originPhone = trimOptional(input.originPhone);
  if (originPhone) body.originPhone = originPhone;

  const destinationContact = trimOptional(input.destinationContact);
  if (destinationContact) body.destinationContact = destinationContact;
  const destinationPhone = trimOptional(input.destinationPhone);
  if (destinationPhone) body.destinationPhone = destinationPhone;
  const destinationEmail = trimOptional(input.destinationEmail);
  if (destinationEmail) body.destinationEmail = destinationEmail;

  if (input.packageCare?.length) body.packageCare = input.packageCare;
  const packageCareNote = trimPackageCareNote(input.packageCareNote);
  if (packageCareNote) body.packageCareNote = packageCareNote;

  if (input.fleteQuote) body.fleteQuote = input.fleteQuote;
  if (input.noteAttributes?.length) body.noteAttributes = input.noteAttributes;

  return body;
}

function readFiniteNumber(bag: Record<string, unknown>, ...keys: string[]): number | null {
  for (const key of keys) {
    const v = bag[key];
    if (typeof v === "number" && Number.isFinite(v)) return v;
  }
  return null;
}

function asRecord(raw: unknown): Record<string, unknown> | null {
  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    return raw as Record<string, unknown>;
  }
  return null;
}

function readPackageSize(raw: unknown): FlipyPackageSize | undefined {
  if (raw === "pequeno" || raw === "mediano" || raw === "grande") return raw;
  return undefined;
}

function readTypeMode(raw: unknown): FlipyTypeMode | undefined {
  if (raw === "express" || raw === "programado" || raw === "recurrente") return raw;
  return undefined;
}

/** Parse fleteQuote from cotizar/create responses. */
export function readFlipyFleteQuote(raw: unknown): FlipyFleteQuote | null {
  const bag = asRecord(raw);
  if (!bag) return null;

  const quoteBag = asRecord(bag.fleteQuote) ?? asRecord(bag.flete_quote) ?? bag;
  const recommendedFare = readFiniteNumber(
    quoteBag,
    "recommendedFare",
    "recommended_fare",
    "fare",
    "price",
  );
  if (recommendedFare == null) return null;

  return {
    version: readFiniteNumber(quoteBag, "version") ?? undefined,
    recommendedFare,
    marketLow: readFiniteNumber(quoteBag, "marketLow", "market_low") ?? undefined,
    marketHigh: readFiniteNumber(quoteBag, "marketHigh", "market_high") ?? undefined,
    minOffer: readFiniteNumber(quoteBag, "minOffer", "min_offer") ?? undefined,
    maxOffer: readFiniteNumber(quoteBag, "maxOffer", "max_offer") ?? undefined,
    distanceKm: readFiniteNumber(quoteBag, "distanceKm", "distance_km") ?? undefined,
    durationMinutes:
      readFiniteNumber(quoteBag, "durationMinutes", "duration_minutes") ?? undefined,
    packageSize: readPackageSize(quoteBag.packageSize ?? quoteBag.package_size),
    typeMode: readTypeMode(quoteBag.typeMode ?? quoteBag.type_mode),
    source: typeof quoteBag.source === "string" ? quoteBag.source : undefined,
  };
}

export function readFlipyCotizarEnvioResult(raw: unknown): FlipyCotizarEnvioResult | null {
  const bag = asRecord(raw);
  if (!bag) return null;
  const fleteQuote = readFlipyFleteQuote(bag);
  if (!fleteQuote) return null;
  return {
    success: bag.success !== false,
    fleteQuote,
  };
}

/** Parse saldo operaciones — Flipy canonical: billeteraOperaciones. */
export function readFlipySaldoOperaciones(raw: unknown): number {
  const bag = asRecord(raw);
  if (!bag) return 0;

  const topLevel = readFiniteNumber(
    bag,
    "billeteraOperaciones",
    "billetera_operaciones",
    "saldoOperaciones",
    "saldo_operaciones",
    "operaciones",
  );
  if (topLevel != null) return topLevel;

  for (const nestedKey of ["billetera", "saldo", "wallet"]) {
    const nested = asRecord(bag[nestedKey]);
    if (!nested) continue;
    const fromNested = readFiniteNumber(
      nested,
      "billeteraOperaciones",
      "billetera_operaciones",
      "operaciones",
      "saldoOperaciones",
      "saldo_operaciones",
    );
    if (fromNested != null) return fromNested;
  }

  return 0;
}

/** Parse saldo reservado — Flipy may use billeteraReservado. */
export function readFlipySaldoReservado(raw: unknown): number | null {
  const bag = asRecord(raw);
  if (!bag) return null;

  const topLevel = readFiniteNumber(
    bag,
    "billeteraReservado",
    "billetera_reservado",
    "saldoReservado",
    "saldo_reservado",
    "reservado",
  );
  if (topLevel != null) return topLevel;

  for (const nestedKey of ["billetera", "saldo", "wallet"]) {
    const nested = asRecord(bag[nestedKey]);
    if (!nested) continue;
    const fromNested = readFiniteNumber(
      nested,
      "billeteraReservado",
      "billetera_reservado",
      "reservado",
      "saldoReservado",
      "saldo_reservado",
    );
    if (fromNested != null) return fromNested;
  }

  return null;
}

export function readFlipySaldoWarningBajo(raw: unknown): boolean {
  const bag = asRecord(raw);
  if (!bag) return false;
  return Boolean(bag.warningBajo ?? bag.warning_bajo ?? bag.saldoBajo ?? bag.saldo_bajo);
}

function readString(bag: Record<string, unknown>, ...keys: string[]): string | null {
  for (const key of keys) {
    const v = bag[key];
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return null;
}

export type FlipyAssignedMotorizado = {
  id: string;
  displayName?: string | null;
  etaMinutes?: number | null;
};

export type FlipyCreateEnvioPartnerResult = {
  envioId: string;
  estado: string;
  contractVersion?: string | null;
  fulfillmentMode?: FlipyOperationalFulfillmentMode | null;
  trackingToken?: string | null;
  trackingUrl?: string | null;
  escenarioPago?: string | null;
  appDeepLink?: string | null;
  appWebUrl?: string | null;
  pujasDeepLink?: string | null;
  pujasWebUrl?: string | null;
  fleteQuote?: FlipyFleteQuote | null;
  assignedMotorizado?: FlipyAssignedMotorizado | null;
};

function readAssignedMotorizado(raw: unknown): FlipyAssignedMotorizado | null {
  const bag = asRecord(raw);
  if (!bag) return null;
  const id = readString(bag, "id", "motorizadoId", "motorizado_id");
  if (!id) return null;
  return {
    id,
    displayName: readString(bag, "displayName", "display_name", "nombre"),
    etaMinutes:
      readFiniteNumber(bag, "etaMinutes", "eta_minutes", "eta") ?? undefined,
  };
}

/** Parse create envío response — v0.2 fields included when present. */
export function readFlipyCreateEnvioResult(raw: unknown): FlipyCreateEnvioPartnerResult | null {
  const bag = asRecord(raw);
  if (!bag) return null;

  const envioId = readString(bag, "envioId", "envio_id", "id");
  if (!envioId) return null;

  const fulfillmentRaw = readString(bag, "fulfillmentMode", "fulfillment_mode");
  const fulfillmentMode =
    fulfillmentRaw === "smart" || fulfillmentRaw === "bid" ? fulfillmentRaw : null;

  return {
    envioId,
    estado: readString(bag, "estado", "status") ?? "PENDIENTE_PUJAS",
    contractVersion: readString(bag, "contractVersion", "contract_version"),
    fulfillmentMode,
    trackingToken: readString(bag, "trackingToken", "tracking_token"),
    trackingUrl: readString(bag, "trackingUrl", "tracking_url"),
    escenarioPago: readString(bag, "escenarioPago", "escenario_pago"),
    appDeepLink: readString(bag, "appDeepLink", "app_deep_link"),
    appWebUrl: readString(bag, "appWebUrl", "app_web_url"),
    pujasDeepLink: readString(bag, "pujasDeepLink", "pujas_deep_link"),
    pujasWebUrl: readString(bag, "pujasWebUrl", "pujas_web_url"),
    fleteQuote: readFlipyFleteQuote(bag),
    assignedMotorizado: readAssignedMotorizado(bag.assignedMotorizado ?? bag.assigned_motorizado),
  };
}
