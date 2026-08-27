/**
 * Partner API contract helpers (v0.2.0).
 * Canonical doc: docs/FLIPY_CODTRACKED_ALIGNMENT_V0.2.md · docs/PARTNER_CODTRACKED.md
 * Keep in sync with flipy/docs/PARTNER_CODTRACKED.md
 */

import type { FlipyEscenarioPago } from "@/lib/integrations/flipy/resolve-payment";

export const FLIPY_PARTNER_CONTRACT_VERSION = "0.2.1";

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
  emailVerifiedAt?: string;
  partnerEmailAssertion?: string;
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
  emailVerifiedAt?: string | null;
  partnerEmailAssertion?: string | null;
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

  const emailVerifiedAt = input.emailVerifiedAt?.trim();
  if (emailVerifiedAt) body.emailVerifiedAt = emailVerifiedAt;

  const partnerEmailAssertion = input.partnerEmailAssertion?.trim();
  if (partnerEmailAssertion) body.partnerEmailAssertion = partnerEmailAssertion;

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

/** Parse billeteraGanancias — COD producto acumulado al entregar. */
export function readFlipySaldoGanancias(raw: unknown): number | null {
  const bag = asRecord(raw);
  if (!bag) return null;

  const topLevel = readFiniteNumber(
    bag,
    "billeteraGanancias",
    "billetera_ganancias",
    "ganancias",
    "saldoGanancias",
    "saldo_ganancias",
  );
  if (topLevel != null) return topLevel;

  for (const nestedKey of ["billetera", "saldo", "wallet"]) {
    const nested = asRecord(bag[nestedKey]);
    if (!nested) continue;
    const fromNested = readFiniteNumber(
      nested,
      "billeteraGanancias",
      "billetera_ganancias",
      "ganancias",
    );
    if (fromNested != null) return fromNested;
  }

  return null;
}

export type FlipyWalletSaldoResult = {
  billeteraOperaciones: number;
  billeteraReservado: number | null;
  billeteraGanancias: number | null;
  retiroMinimo?: number | null;
  destinoRetiroConfigurado?: boolean | null;
  transferGananciasDisponible?: boolean | null;
  canCreateEnvio?: boolean | null;
  warningBajo: boolean;
  warnings?: string[];
};

export type FlipyTransferGananciasInput = {
  monto: number;
};

export type FlipyTransferGananciasSuccessResult = {
  success: true;
  contractVersion?: string | null;
  idempotent: boolean;
  transferId?: string | null;
  monto: number;
  billeteraOperaciones: number;
  billeteraGanancias: number | null;
  billeteraReservado: number | null;
  message?: string | null;
};

/** Full wallet saldo parse — GET /api/partner/tiendas/:id/saldo */
export function readFlipyWalletSaldoResult(raw: unknown): FlipyWalletSaldoResult {
  const bag = asRecord(raw) ?? {};
  const saldoBag = asRecord(bag.saldo) ?? bag;

  const warningsRaw = bag.warnings ?? saldoBag.warnings;
  const warnings = Array.isArray(warningsRaw)
    ? warningsRaw.filter((w): w is string => typeof w === "string" && w.trim().length > 0)
    : undefined;

  return {
    billeteraOperaciones: readFlipySaldoOperaciones(raw),
    billeteraReservado: readFlipySaldoReservado(raw),
    billeteraGanancias: readFlipySaldoGanancias(raw),
    retiroMinimo: readFiniteNumber(bag, "retiroMinimo", "retiro_minimo") ?? undefined,
    destinoRetiroConfigurado:
      typeof bag.destinoRetiroConfigurado === "boolean"
        ? bag.destinoRetiroConfigurado
        : typeof bag.destino_retiro_configurado === "boolean"
          ? bag.destino_retiro_configurado
          : undefined,
    transferGananciasDisponible:
      typeof bag.transferGananciasDisponible === "boolean"
        ? bag.transferGananciasDisponible
        : typeof bag.transfer_ganancias_disponible === "boolean"
          ? bag.transfer_ganancias_disponible
          : undefined,
    canCreateEnvio:
      typeof bag.canCreateEnvio === "boolean"
        ? bag.canCreateEnvio
        : typeof bag.can_create_envio === "boolean"
          ? bag.can_create_envio
          : undefined,
    warningBajo: readFlipySaldoWarningBajo(raw),
    warnings,
  };
}

export function buildFlipyTransferGananciasRequestBody(
  input: FlipyTransferGananciasInput,
): Record<string, unknown> {
  return { monto: input.monto };
}

export function readFlipyTransferGananciasSuccessResult(
  raw: unknown,
): FlipyTransferGananciasSuccessResult | null {
  const bag = asRecord(raw);
  if (!bag) return null;

  const monto = readFiniteNumber(bag, "monto");
  if (monto == null || monto <= 0) return null;

  const saldoBag = asRecord(bag.saldo) ?? bag;

  return {
    success: true,
    contractVersion: readString(bag, "contractVersion", "contract_version"),
    idempotent: Boolean(bag.idempotent),
    transferId: readString(bag, "transferId", "transfer_id", "id"),
    monto,
    billeteraOperaciones: readFlipySaldoOperaciones(saldoBag) || readFlipySaldoOperaciones(bag),
    billeteraGanancias: readFlipySaldoGanancias(saldoBag) ?? readFlipySaldoGanancias(bag),
    billeteraReservado: readFlipySaldoReservado(saldoBag) ?? readFlipySaldoReservado(bag),
    message: readString(bag, "message"),
  };
}

export type FlipyActivateAccountInitInput = {
  contactEmail: string;
  flipyTiendaId?: string | null;
  externalStoreId?: string | null;
  emailVerified?: boolean;
  partnerEmailAssertion?: string | null;
};

export type FlipyTiendaProfileResult = {
  tiendaId: string;
  contactEmail: string | null;
  nombre: string | null;
  externalStoreId: string | null;
  emailVerified: boolean | null;
  emailVerifiedAt: string | null;
  passwordSetAt: string | null;
  /** Flipy: true when password not set; CT UI also requires emailVerified. */
  activationReady: boolean | null;
};

/** GET /api/partner/tiendas/:id — partner tienda profile (email sync). */
export function readFlipyTiendaProfileResult(raw: unknown): FlipyTiendaProfileResult | null {
  const bag = asRecord(raw);
  if (!bag) return null;

  const tiendaId = readString(bag, "tiendaId", "tienda_id", "id");
  if (!tiendaId) return null;

  const userBag = asRecord(bag.user) ?? asRecord(bag.tiendaUser) ?? null;
  const contactEmail =
    readString(bag, "contactEmail", "contact_email", "email") ??
    (userBag ? readString(userBag, "email", "contactEmail", "contact_email") : null);

  const passwordSetAt =
    readString(bag, "passwordSetAt", "password_set_at") ??
    (userBag ? readString(userBag, "passwordSetAt", "password_set_at") : null);

  const emailVerifiedAt =
    readString(bag, "emailVerifiedAt", "email_verified_at") ??
    (userBag ? readString(userBag, "emailVerifiedAt", "email_verified_at") : null);

  const emailVerifiedRaw =
    bag.emailVerified ??
    bag.email_verified ??
    (userBag ? (userBag.emailVerified ?? userBag.email_verified) : null);
  let emailVerified: boolean | null = null;
  if (typeof emailVerifiedRaw === "boolean") {
    emailVerified = emailVerifiedRaw;
  } else if (emailVerifiedAt) {
    emailVerified = true;
  }

  const externalStoreId = readString(bag, "externalStoreId", "external_store_id");

  const activationReadyRaw = bag.activationReady ?? bag.activation_ready;
  let activationReady: boolean | null = null;
  if (typeof activationReadyRaw === "boolean") {
    activationReady = activationReadyRaw;
  } else if (passwordSetAt) {
    activationReady = false;
  } else if (tiendaId) {
    // Flipy v0.2.1: activationReady = !passwordSetAt when field omitted.
    activationReady = true;
  }

  return {
    tiendaId,
    contactEmail,
    nombre: readString(bag, "nombre", "name", "displayName", "display_name"),
    externalStoreId,
    emailVerified,
    emailVerifiedAt,
    passwordSetAt,
    activationReady,
  };
}

export type FlipyActivateAccountInitResult = {
  token: string;
  activationUrl?: string | null;
  expiresAt?: string | null;
  otpRequired?: boolean;
};

export function buildFlipyActivateAccountInitRequestBody(
  input: FlipyActivateAccountInitInput,
): Record<string, unknown> {
  const email = input.contactEmail.trim();
  const body: Record<string, unknown> = {
    contactEmail: email,
    email,
  };
  const externalStoreId = input.externalStoreId?.trim();
  if (externalStoreId) body.externalStoreId = externalStoreId;
  if (input.emailVerified === true) body.emailVerified = true;
  const assertion = input.partnerEmailAssertion?.trim();
  if (assertion) body.partnerEmailAssertion = assertion;
  return body;
}

export function buildFlipyPatchContactEmailRequestBody(input: {
  contactEmail: string;
  emailVerifiedAt?: string | null;
  partnerEmailAssertion?: string | null;
}): Record<string, unknown> {
  const body: Record<string, unknown> = {
    contactEmail: input.contactEmail.trim(),
  };
  const emailVerifiedAt = input.emailVerifiedAt?.trim();
  if (emailVerifiedAt) body.emailVerifiedAt = emailVerifiedAt;
  const assertion = input.partnerEmailAssertion?.trim();
  if (assertion) body.partnerEmailAssertion = assertion;
  return body;
}

/** POST /api/partner/activate-account/init — session token for tienda set-password flow. */
export function readFlipyActivateAccountInitResult(
  raw: unknown,
): FlipyActivateAccountInitResult | null {
  const bag = asRecord(raw);
  if (!bag) return null;

  const token = readString(bag, "token", "activationToken", "activation_token");
  if (!token) return null;

  const otpRequiredRaw = bag.otpRequired ?? bag.otp_required;
  const otpRequired = typeof otpRequiredRaw === "boolean" ? otpRequiredRaw : false;

  return {
    token,
    activationUrl: readString(bag, "activationUrl", "activation_url", "url"),
    expiresAt: readString(bag, "expiresAt", "expires_at"),
    otpRequired,
  };
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

export type FlipyCancelEnvioMotivo =
  | "CLIENTE_CANCELADO"
  | "PEDIDO_DUPLICADO"
  | "ERROR_DIRECCION"
  | "OTRO";

export type FlipyCancelEnvioInput = {
  motivo?: FlipyCancelEnvioMotivo | null;
  motivoLabel?: string | null;
  notas?: string | null;
};

export type FlipyDevolucionInfo = {
  estado?: string | null;
  motivoId?: string | null;
  motivoLabel?: string | null;
  iniciadaAt?: string | null;
  confirmadaAt?: string | null;
  confirmadaPor?: string | null;
  pendienteConfirmacion: boolean;
  resenaHabilitada?: boolean | null;
};

export type FlipyTiendaResena = {
  id: string;
  rating: number;
  peso?: number | null;
  comentario?: string | null;
  createdAt?: string | null;
  autorTipo?: string | null;
};

export type FlipyMotorizadoCalificacionStats = {
  id: string;
  calificacionPromedio?: number | null;
  totalCalificaciones?: number | null;
};

export type FlipyEnvioSummaryResult = {
  envioId: string;
  estado: string;
  externalOrderId?: string | null;
  trackingUrl?: string | null;
  appWebUrl?: string | null;
  appDeepLink?: string | null;
  fulfillmentMode?: FlipyOperationalFulfillmentMode | null;
  devolucion?: FlipyDevolucionInfo | null;
  tiendaResena?: FlipyTiendaResena | null;
  calificacionDisponible?: boolean | null;
  calificacionPeso?: number | null;
};

export type FlipyEnvioByExternalOrderResult = FlipyEnvioSummaryResult;

export type FlipyCancelEnvioSuccessResult = {
  success: true;
  contractVersion?: string | null;
  envioId: string;
  estado: string;
  estadoPrevio?: string | null;
  cancelacionInmediata: boolean;
  idempotent: boolean;
  holdLiberado?: boolean | null;
  message?: string | null;
  externalOrderId?: string | null;
  fulfillmentMode?: FlipyOperationalFulfillmentMode | null;
  trackingUrl?: string | null;
  appDeepLink?: string | null;
  appWebUrl?: string | null;
};

export type FlipyCancelEnvioBlockedDetails = {
  envioId: string;
  externalOrderId?: string | null;
  estado?: string | null;
  resolution?: string | null;
  appDeepLink?: string | null;
  appWebUrl?: string | null;
  trackingUrl?: string | null;
  supportHint?: string | null;
  devolucion?: FlipyDevolucionInfo | null;
};

export type FlipyPartnerApiErrorDetails = FlipyCancelEnvioBlockedDetails;

export type FlipyConfirmarDevolucionInput = {
  notas?: string | null;
};

export type FlipyConfirmarDevolucionSuccessResult = {
  success: true;
  contractVersion?: string | null;
  envioId: string;
  estado: string;
  estadoPrevio?: string | null;
  devolucionConfirmada: boolean;
  idempotent: boolean;
  montoLiberado?: number | null;
  devolucion?: FlipyDevolucionInfo | null;
  message?: string | null;
  trackingUrl?: string | null;
  appWebUrl?: string | null;
};

export type FlipyCalificarEnvioInput = {
  rating: number;
  comentario?: string | null;
};

export type FlipyCalificarEnvioSuccessResult = {
  success: true;
  envioId: string;
  estado: string;
  idempotent: boolean;
  tiendaResena?: FlipyTiendaResena | null;
  calificacionDisponible?: boolean | null;
  calificacionPeso?: number | null;
  motorizado?: FlipyMotorizadoCalificacionStats | null;
  message?: string | null;
};

export type FlipyCancelEnvioBlockedResult = {
  success: false;
  code: string;
  message: string;
  details?: FlipyCancelEnvioBlockedDetails | null;
};

/** POST /api/partner/envios/:id/cancelar — optional body. */
export function buildFlipyCancelEnvioRequestBody(
  input: FlipyCancelEnvioInput,
): Record<string, unknown> | undefined {
  const body: Record<string, unknown> = {};
  if (input.motivo) body.motivo = input.motivo;
  const motivoLabel = trimOptional(input.motivoLabel);
  if (motivoLabel) body.motivoLabel = motivoLabel;
  const notas = trimOptional(input.notas);
  if (notas) body.notas = notas;
  return Object.keys(body).length ? body : undefined;
}

/** POST /api/partner/envios/:id/confirmar-devolucion — optional body. */
export function buildFlipyConfirmarDevolucionRequestBody(
  input: FlipyConfirmarDevolucionInput,
): Record<string, unknown> | undefined {
  const notas = trimOptional(input.notas);
  if (!notas) return undefined;
  return { notas };
}

/** POST /api/partner/envios/:id/calificar */
export function buildFlipyCalificarEnvioRequestBody(
  input: FlipyCalificarEnvioInput,
): Record<string, unknown> {
  const body: Record<string, unknown> = { rating: input.rating };
  const comentario = trimOptional(input.comentario);
  if (comentario) body.comentario = comentario;
  return body;
}

export function readFlipyTiendaResena(raw: unknown): FlipyTiendaResena | null {
  const bag = asRecord(raw);
  if (!bag) return null;

  const id = readString(bag, "id");
  const rating = readFiniteNumber(bag, "rating");
  if (!id || rating == null) return null;

  return {
    id,
    rating,
    peso: readFiniteNumber(bag, "peso") ?? undefined,
    comentario: readString(bag, "comentario", "comment"),
    createdAt: readString(bag, "createdAt", "created_at"),
    autorTipo: readString(bag, "autorTipo", "autor_tipo"),
  };
}

export function readFlipyMotorizadoCalificacionStats(
  raw: unknown,
): FlipyMotorizadoCalificacionStats | null {
  const bag = asRecord(raw);
  if (!bag) return null;

  const id = readString(bag, "id", "motorizadoId", "motorizado_id");
  if (!id) return null;

  return {
    id,
    calificacionPromedio:
      readFiniteNumber(bag, "calificacionPromedio", "calificacion_promedio") ?? undefined,
    totalCalificaciones:
      readFiniteNumber(bag, "totalCalificaciones", "total_calificaciones") ?? undefined,
  };
}

export function readFlipyCalificarEnvioSuccessResult(
  raw: unknown,
): FlipyCalificarEnvioSuccessResult | null {
  const bag = asRecord(raw);
  if (!bag) return null;

  const envioId = readString(bag, "envioId", "envio_id", "id");
  if (!envioId) return null;

  return {
    success: true,
    envioId,
    estado: readString(bag, "estado", "status") ?? "ENTREGADO",
    idempotent: Boolean(bag.idempotent),
    tiendaResena: readFlipyTiendaResena(bag.tiendaResena ?? bag.tienda_resena),
    calificacionDisponible:
      typeof bag.calificacionDisponible === "boolean"
        ? bag.calificacionDisponible
        : typeof bag.calificacion_disponible === "boolean"
          ? bag.calificacion_disponible
          : null,
    calificacionPeso: readFiniteNumber(bag, "calificacionPeso", "calificacion_peso"),
    motorizado: readFlipyMotorizadoCalificacionStats(bag.motorizado),
    message: readString(bag, "message"),
  };
}

export function readFlipyDevolucionInfo(raw: unknown): FlipyDevolucionInfo | null {
  const bag = asRecord(raw);
  if (!bag) return null;

  const pendienteConfirmacion = Boolean(
    bag.pendienteConfirmacion ?? bag.pendiente_confirmacion,
  );
  const estado = readString(bag, "estado", "status");
  const motivoId = readString(bag, "motivoId", "motivo_id");
  const motivoLabel = readString(bag, "motivoLabel", "motivo_label");
  const iniciadaAt = readString(bag, "iniciadaAt", "iniciada_at");
  const confirmadaAt = readString(bag, "confirmadaAt", "confirmada_at");
  const confirmadaPor = readString(bag, "confirmadaPor", "confirmada_por");
  const resenaHabilitada =
    typeof bag.resenaHabilitada === "boolean"
      ? bag.resenaHabilitada
      : typeof bag.resena_habilitada === "boolean"
        ? bag.resena_habilitada
        : null;

  if (
    !estado &&
    !motivoId &&
    !motivoLabel &&
    !iniciadaAt &&
    !confirmadaAt &&
    !pendienteConfirmacion
  ) {
    return null;
  }

  return {
    estado,
    motivoId,
    motivoLabel,
    iniciadaAt,
    confirmadaAt,
    confirmadaPor,
    pendienteConfirmacion,
    resenaHabilitada,
  };
}

export function readFlipyEnvioSummaryResult(raw: unknown): FlipyEnvioSummaryResult | null {
  const bag = asRecord(raw);
  if (!bag) return null;

  const envioId = readString(bag, "envioId", "envio_id", "id");
  if (!envioId) return null;

  const fulfillmentRaw = readString(bag, "fulfillmentMode", "fulfillment_mode");
  const fulfillmentMode =
    fulfillmentRaw === "smart" || fulfillmentRaw === "bid" ? fulfillmentRaw : null;

  const devolucion =
    readFlipyDevolucionInfo(bag.devolucion) ??
    readFlipyDevolucionInfo(asRecord(bag.evidencias)?.devolucion);

  const calificacionDisponible =
    typeof bag.calificacionDisponible === "boolean"
      ? bag.calificacionDisponible
      : typeof bag.calificacion_disponible === "boolean"
        ? bag.calificacion_disponible
        : null;

  return {
    envioId,
    estado: readString(bag, "estado", "status") ?? "UNKNOWN",
    externalOrderId: readString(bag, "externalOrderId", "external_order_id"),
    trackingUrl: readString(bag, "trackingUrl", "tracking_url"),
    appWebUrl: readString(bag, "appWebUrl", "app_web_url"),
    appDeepLink: readString(bag, "appDeepLink", "app_deep_link"),
    fulfillmentMode,
    devolucion,
    tiendaResena: readFlipyTiendaResena(bag.tiendaResena ?? bag.tienda_resena),
    calificacionDisponible,
    calificacionPeso: readFiniteNumber(bag, "calificacionPeso", "calificacion_peso"),
  };
}

export function readFlipyEnvioByExternalOrderResult(
  raw: unknown,
): FlipyEnvioByExternalOrderResult | null {
  return readFlipyEnvioSummaryResult(raw);
}

export function readFlipyCancelEnvioBlockedDetails(
  raw: unknown,
): FlipyCancelEnvioBlockedDetails | null {
  const bag = asRecord(raw);
  if (!bag) return null;

  const envioId = readString(bag, "envioId", "envio_id", "id");
  if (!envioId) return null;

  return {
    envioId,
    externalOrderId: readString(bag, "externalOrderId", "external_order_id"),
    estado: readString(bag, "estado", "status"),
    resolution: readString(bag, "resolution"),
    appDeepLink: readString(bag, "appDeepLink", "app_deep_link"),
    appWebUrl: readString(bag, "appWebUrl", "app_web_url"),
    trackingUrl: readString(bag, "trackingUrl", "tracking_url"),
    supportHint: readString(bag, "supportHint", "support_hint"),
    devolucion: readFlipyDevolucionInfo(bag.devolucion),
  };
}

export function readFlipyCancelEnvioBlockedResult(
  raw: unknown,
): FlipyCancelEnvioBlockedResult | null {
  const bag = asRecord(raw);
  if (!bag) return null;

  const code = readString(bag, "code", "errorCode");
  const message = readString(bag, "message", "error", "detail");
  if (!code || !message) return null;

  const detailsRaw = bag.details ?? bag.errorDetails;
  return {
    success: false,
    code,
    message,
    details: readFlipyCancelEnvioBlockedDetails(detailsRaw),
  };
}

export function readFlipyCancelEnvioSuccessResult(
  raw: unknown,
): FlipyCancelEnvioSuccessResult | null {
  const bag = asRecord(raw);
  if (!bag) return null;

  const envioId = readString(bag, "envioId", "envio_id", "id");
  if (!envioId) return null;

  const fulfillmentRaw = readString(bag, "fulfillmentMode", "fulfillment_mode");
  const fulfillmentMode =
    fulfillmentRaw === "smart" || fulfillmentRaw === "bid" ? fulfillmentRaw : null;

  return {
    success: true,
    contractVersion: readString(bag, "contractVersion", "contract_version"),
    envioId,
    estado: readString(bag, "estado", "status") ?? "CANCELADO",
    estadoPrevio: readString(bag, "estadoPrevio", "estado_previo"),
    cancelacionInmediata: bag.cancelacionInmediata !== false && bag.cancelacion_inmediata !== false,
    idempotent: Boolean(bag.idempotent),
    holdLiberado:
      typeof bag.holdLiberado === "boolean"
        ? bag.holdLiberado
        : typeof bag.hold_liberado === "boolean"
          ? bag.hold_liberado
          : null,
    message: readString(bag, "message"),
    externalOrderId: readString(bag, "externalOrderId", "external_order_id"),
    fulfillmentMode,
    trackingUrl: readString(bag, "trackingUrl", "tracking_url"),
    appDeepLink: readString(bag, "appDeepLink", "app_deep_link"),
    appWebUrl: readString(bag, "appWebUrl", "app_web_url"),
  };
}

export function readFlipyConfirmarDevolucionSuccessResult(
  raw: unknown,
): FlipyConfirmarDevolucionSuccessResult | null {
  const bag = asRecord(raw);
  if (!bag) return null;

  const envioId = readString(bag, "envioId", "envio_id", "id");
  if (!envioId) return null;

  return {
    success: true,
    contractVersion: readString(bag, "contractVersion", "contract_version"),
    envioId,
    estado: readString(bag, "estado", "status") ?? "CANCELADO",
    estadoPrevio: readString(bag, "estadoPrevio", "estado_previo"),
    devolucionConfirmada: bag.devolucionConfirmada !== false && bag.devolucion_confirmada !== false,
    idempotent: Boolean(bag.idempotent),
    montoLiberado: readFiniteNumber(bag, "montoLiberado", "monto_liberado"),
    devolucion: readFlipyDevolucionInfo(bag.devolucion),
    message: readString(bag, "message"),
    trackingUrl: readString(bag, "trackingUrl", "tracking_url"),
    appWebUrl: readString(bag, "appWebUrl", "app_web_url"),
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
