import type {
  FlipyEscenarioPago,
  FlipyPaymentResolution,
} from "@/lib/integrations/flipy/resolve-payment";

export const FLIPY_USER_ESCENARIOS = ["1A", "1C", "1E", "1D"] as const satisfies readonly FlipyEscenarioPago[];

/** COD collection channels at destination (Yape / cash / digital). */
export const FLIPY_COD_ESCENARIOS = ["1C", "1E", "1D"] as const satisfies readonly FlipyEscenarioPago[];

/** Flipy Yape cap — 1C + codAmount above this should suggest 1D. */
export const FLIPY_YAPE_COD_TOPE = 300;

/** Short labels for COD channel selection in the wizard UI. */
export const FLIPY_COD_CHANNEL_SHORT: Record<(typeof FLIPY_COD_ESCENARIOS)[number], string> = {
  "1C": "Yape",
  "1E": "Efectivo",
  "1D": "Tarjeta",
};

export function labelFlipyCodChannel(
  value: FlipyEscenarioPago | null | undefined,
): string | null {
  if (value === "1C" || value === "1E" || value === "1D") {
    return FLIPY_COD_CHANNEL_SHORT[value];
  }
  return null;
}

const ESCENARIO_LABELS: Record<(typeof FLIPY_USER_ESCENARIOS)[number], string> = {
  "1A": "1A — Prepago total",
  "1C": "1C — Yape al motorizado",
  "1E": "1E — Efectivo",
  "1D": "1D — Digital (tarjeta en rastreo)",
};

const ESCENARIO_HINTS: Record<(typeof FLIPY_USER_ESCENARIOS)[number], string> = {
  "1A": "Todo pagado en checkout — nada que cobrar en destino. Con flete prepagado: asignación automática Flipy.",
  "1C": "Cliente paga en destino vía Yape directo al motorizado (P + F según lo que falte cobrar).",
  "1E": "Cliente paga en destino en efectivo al motorizado (P + F según lo que falte cobrar).",
  "1D": "Cliente paga en destino con tarjeta/Stripe en el link de rastreo (P + F según lo que falte cobrar).",
};

export const FLIPY_ESCENARIO_OPTIONS = FLIPY_USER_ESCENARIOS.map((value) => ({
  value,
  label: ESCENARIO_LABELS[value],
  hint: ESCENARIO_HINTS[value],
}));

export const FLIPY_COD_ESCENARIO_OPTIONS = FLIPY_COD_ESCENARIOS.map((value) => ({
  value,
  label: ESCENARIO_LABELS[value],
  hint: ESCENARIO_HINTS[value],
}));

/**
 * Flete prepagado en checkout Shopify (D4) → smart eligible for flete lock / 1A path.
 * Independent of escenario channel (1C/1E/1D).
 */
export function isFlipyPrepaidFreight(
  resolution: Pick<FlipyPaymentResolution, "shippingPaidAtCheckout">,
): boolean {
  return resolution.shippingPaidAtCheckout === true;
}

/** D3: nothing left to collect at destination → 1A only, skip COD channel step. */
export function shouldSkipFlipyCodPaymentStep(
  resolution: Pick<FlipyPaymentResolution, "productPaidAtCheckout" | "shippingPaidAtCheckout">,
): boolean {
  return resolution.productPaidAtCheckout && resolution.shippingPaidAtCheckout;
}

/** D3: product and/or freight still to collect at destination. */
export function hasFlipyDestinoCobro(resolution: FlipyPaymentResolution): boolean {
  return !shouldSkipFlipyCodPaymentStep(resolution);
}

/**
 * Modalidad inicial del wizard:
 * - P + F prepagados → 1A
 * - hay cobro en destino → default sugerido o 1E
 */
export function initialFlipyEscenarioForUi(resolution: FlipyPaymentResolution): FlipyEscenarioPago {
  if (shouldSkipFlipyCodPaymentStep(resolution)) return "1A";
  const suggested = resolution.suggestedEscenario;
  if (suggested === "1C" || suggested === "1E" || suggested === "1D") return suggested;
  return "1E";
}

/** COD channel options when something remains to collect at destination (D3). */
export function flipyEscenarioOptionsForUi(resolution: FlipyPaymentResolution) {
  if (shouldSkipFlipyCodPaymentStep(resolution)) return [];
  return FLIPY_COD_ESCENARIO_OPTIONS;
}

export function labelFlipyEscenario(value: FlipyEscenarioPago | null | undefined): string {
  if (!value || value === "GRATIS") return value === "GRATIS" ? "Gratis" : "—";
  return ESCENARIO_LABELS[value as (typeof FLIPY_USER_ESCENARIOS)[number]] ?? value;
}

export function describeFlipyEscenario(value: FlipyEscenarioPago): string {
  if (value === "GRATIS") return "Envío sin cobro al cliente.";
  return ESCENARIO_HINTS[value as (typeof FLIPY_USER_ESCENARIOS)[number]] ?? "";
}

/**
 * codAmount for Flipy create — from D3 (Shopify), not from escenario channel.
 * 1C/1E/1D share the same product amount; 0/null when P already paid in checkout.
 */
export function deriveCodAmountFromD3(
  escenario: FlipyEscenarioPago,
  payment: Pick<FlipyPaymentResolution, "codAmount" | "expectedCodProduct">,
  subtotalFallback?: number | null,
): number | null {
  if (escenario === "1A" || escenario === "GRATIS") return null;
  if (payment.codAmount != null && payment.codAmount > 0) return payment.codAmount;
  if (payment.expectedCodProduct > 0) return payment.expectedCodProduct;
  const fallback = subtotalFallback ?? null;
  if (fallback != null && fallback > 0) return fallback;
  return null;
}

/** @deprecated Use deriveCodAmountFromD3 */
export const deriveCodAmountForEscenario = deriveCodAmountFromD3;

export type FlipyShopifyPaymentSummary = {
  alertBody: string;
  productLabel: string;
  shippingLabel: string;
  codProductLabel: string | null;
  destinoCobroLabel: string;
};

export function buildFlipyShopifyPaymentSummary(
  resolution: FlipyPaymentResolution,
  formatAmount: (value: number) => string,
): FlipyShopifyPaymentSummary {
  const productLabel = resolution.productPaidAtCheckout
    ? "Prepago en Shopify"
    : `COD — ${formatAmount(resolution.expectedCodProduct)}`;
  const shippingLabel = resolution.shippingPaidAtCheckout
    ? "Prepago en Shopify"
    : resolution.expectedCodShipping > 0
      ? `No prepagado — ${formatAmount(resolution.expectedCodShipping)} en checkout`
      : "No prepagado — se define como oferta de flete";

  const codAmount = resolution.codAmount ?? resolution.expectedCodProduct;
  const codProductLabel =
    !resolution.productPaidAtCheckout && codAmount > 0 ? formatAmount(codAmount) : null;

  const destinoParts: string[] = [];
  if (!resolution.productPaidAtCheckout && codAmount > 0) {
    destinoParts.push(`producto ${formatAmount(codAmount)}`);
  }
  if (!resolution.shippingPaidAtCheckout) {
    destinoParts.push("flete (oferta de pujas)");
  }
  const destinoCobroLabel =
    destinoParts.length > 0
      ? `En destino se cobra: ${destinoParts.join(" + ")}`
      : "Nada que cobrar en destino";

  const alertBody =
    shouldSkipFlipyCodPaymentStep(resolution)
      ? "Producto y flete prepagados en Shopify — sin cobro en destino."
      : "Hay cobro en destino según Shopify. Elige el canal: Yape, efectivo o tarjeta. Los montos los define Shopify, no el canal de cobro.";

  return { alertBody, productLabel, shippingLabel, codProductLabel, destinoCobroLabel };
}

export function shouldSuggestFlipyEscenario1DForYape(
  escenario: FlipyEscenarioPago,
  codAmount: number | null | undefined,
): boolean {
  return escenario === "1C" && codAmount != null && codAmount > FLIPY_YAPE_COD_TOPE;
}
