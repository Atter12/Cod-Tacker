import {
  isFlipyPrepaidFreight,
  shouldSkipFlipyCodPaymentStep,
} from "@/lib/integrations/flipy/labels";
import type { FlipyEscenarioPago, FlipyPaymentResolution } from "@/lib/integrations/flipy/resolve-payment";
import type { Json } from "@/types/database.generated";

export type FlipyFletePaymentStatus = "n_a" | "prepaid" | "expected" | "collected";

export type FlipyFletePaymentVia = "create" | "delivered" | "settlement" | "manual";

const STATUS_LABELS: Record<FlipyFletePaymentStatus, string> = {
  n_a: "Sin flete",
  prepaid: "Flete prepago",
  expected: "Flete por cobrar",
  collected: "Flete cobrado",
};

export function labelFlipyFletePaymentStatus(status: FlipyFletePaymentStatus): string {
  return STATUS_LABELS[status];
}

/** Badge status key for StatusBadge color map. */
export function flipyFletePaymentBadgeStatus(status: FlipyFletePaymentStatus): string {
  switch (status) {
    case "collected":
      return "flete_collected";
    case "expected":
      return "flete_expected";
    case "prepaid":
      return "flete_prepaid";
    default:
      return "flete_na";
  }
}

function readMeta(metadata: Json | null | undefined): Record<string, unknown> {
  if (metadata && typeof metadata === "object" && !Array.isArray(metadata)) {
    return metadata as Record<string, unknown>;
  }
  return {};
}

function readShopifyFlipyPayment(meta: Record<string, unknown>): Record<string, unknown> | null {
  const raw = meta.shopify_flipy_payment;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  return raw as Record<string, unknown>;
}

function parseStoredStatus(raw: unknown): FlipyFletePaymentStatus | null {
  if (raw === "n_a" || raw === "prepaid" || raw === "expected" || raw === "collected") {
    return raw;
  }
  if (raw === "n/a" || raw === "na") return "n_a";
  return null;
}

export function parseStoredFlipyFletePaymentStatus(
  raw: unknown,
): FlipyFletePaymentStatus | null {
  return parseStoredStatus(raw);
}

export function initialFlipyFletePaymentStatus(input: {
  payment: Pick<
    FlipyPaymentResolution,
    "productPaidAtCheckout" | "shippingPaidAtCheckout" | "smartEligible"
  >;
  escenario: FlipyEscenarioPago;
  fletePrice?: number | null;
}): FlipyFletePaymentStatus {
  if (input.escenario === "GRATIS") return "n_a";
  if (input.escenario === "1A" || shouldSkipFlipyCodPaymentStep(input.payment)) {
    return "prepaid";
  }
  if (isFlipyPrepaidFreight(input.payment)) {
    return "prepaid";
  }
  const flete = input.fletePrice;
  if (flete != null && Number.isFinite(flete) && flete <= 0) {
    return "n_a";
  }
  return "expected";
}

/**
 * Resolve badge for UI. Prefers persisted metadata; falls back for older envíos.
 * Returns null when there is no Flipy shipment (badge hidden).
 */
export function resolveFlipyFletePaymentStatus(input: {
  metadata: Json | null | undefined;
  flipyEnvioId: string | null | undefined;
  flipyEstado?: string | null;
  payment?: Pick<
    FlipyPaymentResolution,
    "productPaidAtCheckout" | "shippingPaidAtCheckout" | "smartEligible"
  > | null;
  confirmedEscenario?: FlipyEscenarioPago | null;
}): FlipyFletePaymentStatus | null {
  if (!input.flipyEnvioId) return null;

  const meta = readMeta(input.metadata);
  const paymentMeta = readShopifyFlipyPayment(meta);
  const stored = parseStoredStatus(paymentMeta?.fletePaymentStatus);
  if (stored) {
    // Live ENTREGADO can promote expected → collected before settlement if patch lagged.
    const estado = input.flipyEstado?.trim().toUpperCase() ?? "";
    if (stored === "expected" && estado === "ENTREGADO") {
      return "collected";
    }
    return stored;
  }

  const escenario =
    input.confirmedEscenario ??
    (typeof paymentMeta?.confirmedEscenario === "string"
      ? (paymentMeta.confirmedEscenario as FlipyEscenarioPago)
      : null);

  if (input.payment) {
    const seed = initialFlipyFletePaymentStatus({
      payment: input.payment,
      escenario: escenario ?? "1E",
      fletePrice:
        typeof paymentMeta?.fletePrice === "number" ? paymentMeta.fletePrice : null,
    });
    const estado = input.flipyEstado?.trim().toUpperCase() ?? "";
    if (seed === "expected" && estado === "ENTREGADO") return "collected";
    return seed;
  }

  const estado = input.flipyEstado?.trim().toUpperCase() ?? "";
  if (estado === "ENTREGADO") return "collected";
  if (escenario === "1A" || escenario === "GRATIS") return escenario === "GRATIS" ? "n_a" : "prepaid";
  return "expected";
}

/** Merge fletePaymentStatus into shopify_flipy_payment without clobbering other keys. */
export function mergeFlipyFletePaymentIntoMetadata(
  metadata: Json | null | undefined,
  input: {
    status: FlipyFletePaymentStatus;
    via: FlipyFletePaymentVia;
    at?: string;
  },
): Record<string, unknown> {
  const meta = { ...readMeta(metadata) };
  const prev = readShopifyFlipyPayment(meta) ?? {};
  const prevStatus = parseStoredStatus(prev.fletePaymentStatus);
  // Don't downgrade collected → expected.
  if (prevStatus === "collected" && input.status !== "collected") {
    return meta;
  }
  const at = input.at ?? new Date().toISOString();
  meta.shopify_flipy_payment = {
    ...prev,
    fletePaymentStatus: input.status,
    fletePaymentUpdatedAt: at,
    fletePaymentVia: input.via,
    ...(input.status === "collected"
      ? { fleteCollectedAt: typeof prev.fleteCollectedAt === "string" ? prev.fleteCollectedAt : at }
      : {}),
  };
  return meta;
}

/** True when ENTREGADO should mark door freight as collected. */
export function shouldMarkFlipyFleteCollectedOnDelivered(
  current: FlipyFletePaymentStatus | null | undefined,
): boolean {
  return current === "expected" || current == null;
}
