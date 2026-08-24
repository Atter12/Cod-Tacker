/**
 * Partner API contract helpers (v0.1.1 freeze).
 * Canonical doc: docs/PARTNER_CODTRACKED.md
 * Keep in sync with flipy/docs/PARTNER_CODTRACKED.md
 */

export const FLIPY_PARTNER_CONTRACT_VERSION = "0.1.1";

export type FlipyOriginLocation = {
  address: string;
  lat: number;
  lng: number;
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
