import type {
  FlipyEscenarioPago,
  FlipyPaymentResolution,
} from "@/lib/integrations/flipy/resolve-payment";

export const FLIPY_USER_ESCENARIOS = ["1A", "1C", "1E", "1D"] as const satisfies readonly FlipyEscenarioPago[];

/** COD modalities shown when Shopify did not prepay freight (never include 1A). */
export const FLIPY_COD_ESCENARIOS = ["1C", "1E", "1D"] as const satisfies readonly FlipyEscenarioPago[];

const ESCENARIO_LABELS: Record<(typeof FLIPY_USER_ESCENARIOS)[number], string> = {
  "1A": "1A — Prepago total",
  "1C": "1C — COD producto",
  "1E": "1E — COD producto + envío",
  "1D": "1D — COD envío",
};

const ESCENARIO_HINTS: Record<(typeof FLIPY_USER_ESCENARIOS)[number], string> = {
  "1A": "Producto y envío pagados en Shopify. Define COD vs prepago; el flete se fija después como oferta a motorizados.",
  "1C": "Cliente paga el producto contra entrega. El flete se fija después como oferta.",
  "1E": "Cliente paga producto y envío contra entrega (típico COD). El flete se fija después como oferta.",
  "1D": "Producto prepago; solo el envío se cobra contra entrega. El flete se fija después como oferta.",
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
 * Pedido prepago en Shopify (producto/flete online) → bloquear 1A.
 * Si no está prepago (COD), el modal solo ofrece 1C / 1E / 1D.
 */
export function isFlipyPrepaidFreight(
  resolution: Pick<FlipyPaymentResolution, "productPaidAtCheckout" | "shippingPaidAtCheckout">,
): boolean {
  return resolution.productPaidAtCheckout === true || resolution.shippingPaidAtCheckout === true;
}

/**
 * Modalidad inicial del wizard:
 * - flete prepago en Shopify → 1A
 * - si no → solo COD (1C/1E/1D); cae a 1E si la sugerencia no es COD
 */
export function initialFlipyEscenarioForUi(resolution: FlipyPaymentResolution): FlipyEscenarioPago {
  if (isFlipyPrepaidFreight(resolution)) return "1A";
  const suggested = resolution.suggestedEscenario;
  if (suggested === "1C" || suggested === "1E" || suggested === "1D") return suggested;
  return "1E";
}

/** Options the merchant may pick on the payment step (empty when prepaid freight → skip). */
export function flipyEscenarioOptionsForUi(resolution: FlipyPaymentResolution) {
  if (isFlipyPrepaidFreight(resolution)) return [];
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
