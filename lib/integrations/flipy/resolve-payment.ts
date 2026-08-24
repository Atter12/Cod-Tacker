import {
  mapShopifyPayment,
  type ShopifyPaymentKind,
} from "@/lib/integrations/shopify/map-payment";

export type FlipyEscenarioPago = "1A" | "1C" | "1E" | "1D" | "GRATIS";

export type FlipyPaymentResolution = {
  fulfillmentMode: "delivery" | "pickup" | "unknown";
  productPaidAtCheckout: boolean;
  shippingPaidAtCheckout: boolean;
  suggestedEscenario: FlipyEscenarioPago | null;
  codAmount: number | null;
  suggestedFlete: number | null;
  confidence: "high" | "medium" | "low";
  requiresUserConfirmation: boolean;
  reasons: string[];
};

export type FlipyShippingLineInput = {
  title?: string | null;
  code?: string | null;
};

export type FlipyNoteAttributeInput = {
  name?: string | null;
  value?: string | null;
};

export type FlipyOrderPaymentInput = {
  payment_kind?: ShopifyPaymentKind | null;
  subtotal_amount?: number | null;
  shipping_amount?: number | null;
  total_amount?: number | null;
  expected_cod_amount?: number | null;
  shipping_lines?: Array<FlipyShippingLineInput | null> | null;
  note_attributes?: Array<FlipyNoteAttributeInput | null> | null;
  pickup_keywords?: string[] | null;
  financialStatus?: string | null;
  tags?: string[] | string | null;
  paymentGatewayNames?: string[] | string | null;
  gateway?: string | null;
};

const AMOUNT_TOLERANCE = 0.05;

const PICKUP_TEXT =
  /\b(pickup|pick[\s-]?up|local\s*pickup|recojo|retiro|retirar|pick\s*up\s*in\s*store)\b/i;

function finiteAmount(value: number | null | undefined): number {
  if (typeof value === "number" && Number.isFinite(value)) return Math.max(0, value);
  return 0;
}

function amountsApprox(a: number, b: number): boolean {
  return Math.abs(a - b) <= AMOUNT_TOLERANCE;
}

function normalizePickupText(value: string): string {
  return value.replace(/[_-]+/g, " ").toLowerCase();
}

function isPickupShippingLine(
  line: FlipyShippingLineInput | null | undefined,
  extraKeywords: string[],
): boolean {
  if (!line) return false;
  const title = normalizePickupText(line.title?.trim() ?? "");
  const code = normalizePickupText(line.code?.trim() ?? "");
  if (PICKUP_TEXT.test(title) || PICKUP_TEXT.test(code)) return true;
  return extraKeywords.some((keyword) => {
    const normalized = normalizePickupText(keyword);
    if (!normalized) return false;
    return title.includes(normalized) || code.includes(normalized);
  });
}

function detectFulfillmentMode(
  shippingLines: Array<FlipyShippingLineInput | null> | null | undefined,
  extraKeywords: string[],
): "delivery" | "pickup" | "unknown" {
  if (!Array.isArray(shippingLines) || shippingLines.length === 0) return "unknown";
  if (shippingLines.some((line) => isPickupShippingLine(line, extraKeywords))) return "pickup";
  return "delivery";
}

const FLIPY_ESCENARIO_NOTE_KEYS = [
  "flipy_escenario",
  "flipy_escenario_pago",
  "codtracked_flipy_escenario",
  "flipy_pago_escenario",
  "escenario_pago",
  "escenario",
] as const;

function parseEscenarioOverride(
  noteAttributes: Array<FlipyNoteAttributeInput | null> | null | undefined,
): FlipyEscenarioPago | null {
  if (!Array.isArray(noteAttributes)) return null;
  for (const attr of noteAttributes) {
    if (!attr) continue;
    const name = attr.name?.trim().toLowerCase();
    if (!name || !FLIPY_ESCENARIO_NOTE_KEYS.some((key) => key === name)) continue;
    const value = attr.value?.trim().toUpperCase();
    if (value === "1A" || value === "1C" || value === "1E" || value === "1D" || value === "GRATIS") {
      return value;
    }
  }
  return null;
}

function resolvePaymentKind(input: FlipyOrderPaymentInput): ShopifyPaymentKind {
  if (input.payment_kind === "cod" || input.payment_kind === "prepaid") {
    return input.payment_kind;
  }

  const total = finiteAmount(input.total_amount);
  const mapped = mapShopifyPayment({
    financialStatus: input.financialStatus,
    tags: input.tags,
    paymentGatewayNames: input.paymentGatewayNames,
    gateway: input.gateway,
    totalAmount: total,
  });
  return mapped.payment_kind;
}

/**
 * Map Shopify order amounts + payment signals → suggested Flipy escenario.
 * See docs/FLIPY_CODTRACKED_INTEGRATION_MASTER.md §6 and docs/FLIPY_F0_SHOPIFY_PAYMENT_CASES.md.
 */
export function resolveShopifyFlipyPayment(input: FlipyOrderPaymentInput): FlipyPaymentResolution {
  const reasons: string[] = [];
  const pickupKeywords = (input.pickup_keywords ?? []).map((entry) => entry.trim()).filter(Boolean);
  const fulfillmentMode = detectFulfillmentMode(input.shipping_lines, pickupKeywords);
  const escenarioOverride = parseEscenarioOverride(input.note_attributes);

  if (fulfillmentMode === "pickup") {
    reasons.push("shipping_line_indicates_pickup");
    return {
      fulfillmentMode: "pickup",
      productPaidAtCheckout: false,
      shippingPaidAtCheckout: false,
      suggestedEscenario: null,
      codAmount: null,
      suggestedFlete: null,
      confidence: "high",
      requiresUserConfirmation: false,
      reasons,
    };
  }

  const subtotal = finiteAmount(input.subtotal_amount);
  const shipping = finiteAmount(input.shipping_amount);
  const total = finiteAmount(input.total_amount);
  const expected =
    input.expected_cod_amount != null ? finiteAmount(input.expected_cod_amount) : total;

  const paymentKind = resolvePaymentKind(input);
  const productPaidAtCheckout = paymentKind === "prepaid";
  const shippingPaidAtCheckout = productPaidAtCheckout && shipping > 0;

  if (paymentKind === "prepaid") {
    reasons.push("payment_kind_prepaid");

    if (shipping > 0) {
      reasons.push("shipping_paid_at_checkout");
      const resolution: FlipyPaymentResolution = {
        fulfillmentMode,
        productPaidAtCheckout: true,
        shippingPaidAtCheckout: true,
        suggestedEscenario: escenarioOverride ?? "1A",
        codAmount: null,
        suggestedFlete: shipping,
        confidence: escenarioOverride ? "high" : "high",
        requiresUserConfirmation: escenarioOverride ? false : false,
        reasons: escenarioOverride ? [...reasons, "note_attribute_escenario_override"] : reasons,
      };
      return resolution;
    }

    reasons.push("prepaid_zero_shipping_confirm_flete");
    return {
      fulfillmentMode,
      productPaidAtCheckout: true,
      shippingPaidAtCheckout: false,
      suggestedEscenario: escenarioOverride ?? "1A",
      codAmount: null,
      suggestedFlete: null,
      confidence: escenarioOverride ? "high" : "medium",
      requiresUserConfirmation: escenarioOverride ? false : true,
      reasons: escenarioOverride ? [...reasons, "note_attribute_escenario_override"] : reasons,
    };
  }

  reasons.push("payment_kind_cod");

  const expectedMatchesTotal = amountsApprox(expected, total);
  const expectedMatchesSubtotal = amountsApprox(expected, subtotal);
  const expectedMatchesSubtotalPlusShipping = amountsApprox(expected, subtotal + shipping);

  if (expectedMatchesSubtotalPlusShipping || expectedMatchesTotal) {
    reasons.push(
      expectedMatchesSubtotalPlusShipping
        ? "expected_matches_subtotal_plus_shipping"
        : "expected_matches_total",
    );
    return {
      fulfillmentMode,
      productPaidAtCheckout: false,
      shippingPaidAtCheckout: false,
      suggestedEscenario: escenarioOverride ?? "1E",
      codAmount: subtotal > 0 ? subtotal : null,
      suggestedFlete: shipping > 0 ? shipping : null,
      confidence: escenarioOverride ? "high" : "high",
      requiresUserConfirmation: escenarioOverride ? false : true,
      reasons: escenarioOverride ? [...reasons, "note_attribute_escenario_override"] : reasons,
    };
  }

  if (expectedMatchesSubtotal) {
    reasons.push("expected_matches_subtotal_only");
    return {
      fulfillmentMode,
      productPaidAtCheckout: false,
      shippingPaidAtCheckout: false,
      suggestedEscenario: escenarioOverride ?? "1E",
      codAmount: subtotal,
      suggestedFlete: null,
      confidence: escenarioOverride ? "high" : "medium",
      requiresUserConfirmation: escenarioOverride ? false : true,
      reasons: escenarioOverride ? [...reasons, "note_attribute_escenario_override"] : reasons,
    };
  }

  reasons.push("amounts_ambiguous_confirm_required");
  const inferredCod =
    expected > 0 && expected <= subtotal ? expected : subtotal > 0 ? subtotal : expected;

  return {
    fulfillmentMode,
    productPaidAtCheckout: false,
    shippingPaidAtCheckout: false,
    suggestedEscenario: escenarioOverride ?? "1E",
    codAmount: inferredCod > 0 ? inferredCod : null,
    suggestedFlete: shipping > 0 ? shipping : null,
    confidence: escenarioOverride ? "medium" : "low",
    requiresUserConfirmation: escenarioOverride ? false : true,
    reasons: escenarioOverride ? [...reasons, "note_attribute_escenario_override"] : reasons,
  };
}
