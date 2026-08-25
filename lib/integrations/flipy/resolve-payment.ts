import {
  mapShopifyPayment,
  type ShopifyPaymentKind,
} from "@/lib/integrations/shopify/map-payment";

export type FlipyEscenarioPago = "1A" | "1C" | "1E" | "1D" | "GRATIS";

export type FlipyShippingFulfillmentMode = "delivery" | "pickup" | "unknown";

/** Smart vs bid bifurcation for Flipy Partner API v0.2 (D3/D4). */
export type FlipyOperationalFulfillmentMode = "smart" | "bid";

export type FlipyPaymentResolution = {
  /** Recojo vs envío a domicilio (unchanged v0.1). */
  fulfillmentMode: FlipyShippingFulfillmentMode;
  productPaidAtCheckout: boolean;
  shippingPaidAtCheckout: boolean;
  /** D4: necessary condition for smart — shipping prepaid at checkout only. */
  smartEligible: boolean;
  /** Derived from D4: smart when smartEligible, else bid. Null for pickup. */
  flipyFulfillmentMode: FlipyOperationalFulfillmentMode | null;
  expectedCodProduct: number;
  expectedCodShipping: number;
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

function detectShippingFulfillmentMode(
  shippingLines: Array<FlipyShippingLineInput | null> | null | undefined,
  extraKeywords: string[],
): FlipyShippingFulfillmentMode {
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

type PartialPaymentSignals = {
  productPaidAtCheckout: boolean;
  shippingPaidAtCheckout: boolean;
  reasons: string[];
};

/**
 * D3 partial-payment detection — product and shipping paid independently.
 * See docs/FLIPY_CODTRACKED_ALIGNMENT_V0.2.md §1 (D3 matrix).
 */
function resolvePartialPaymentSignals(
  input: FlipyOrderPaymentInput,
  paymentKind: ShopifyPaymentKind,
): PartialPaymentSignals {
  const reasons: string[] = [];
  const subtotal = finiteAmount(input.subtotal_amount);
  const shipping = finiteAmount(input.shipping_amount);
  const total = finiteAmount(input.total_amount);
  const expected =
    input.expected_cod_amount != null ? finiteAmount(input.expected_cod_amount) : total;

  const expectedMatchesSubtotal = amountsApprox(expected, subtotal);
  const expectedMatchesSubtotalPlusShipping = amountsApprox(expected, subtotal + shipping);
  const totalMatchesSubtotal = amountsApprox(total, subtotal);
  const totalMatchesSubtotalPlusShipping = amountsApprox(total, subtotal + shipping);
  const totalMatchesShippingOnly = shipping > 0 && amountsApprox(total, shipping);

  if (paymentKind === "prepaid") {
    reasons.push("payment_kind_prepaid");
    const productPaidAtCheckout = true;

    if (shipping <= 0) {
      reasons.push("prepaid_zero_shipping");
      return {
        productPaidAtCheckout,
        shippingPaidAtCheckout: false,
        reasons,
      };
    }

    if (totalMatchesSubtotalPlusShipping) {
      reasons.push("shipping_paid_at_checkout");
      return {
        productPaidAtCheckout,
        shippingPaidAtCheckout: true,
        reasons,
      };
    }

    if (totalMatchesSubtotal) {
      reasons.push("prepaid_product_only_shipping_cod");
      return {
        productPaidAtCheckout,
        shippingPaidAtCheckout: false,
        reasons,
      };
    }

    reasons.push("prepaid_shipping_ambiguous");
    return {
      productPaidAtCheckout,
      shippingPaidAtCheckout: false,
      reasons,
    };
  }

  reasons.push("payment_kind_cod");
  const productPaidAtCheckout = false;

  if (shipping <= 0) {
    return {
      productPaidAtCheckout,
      shippingPaidAtCheckout: false,
      reasons,
    };
  }

  if (totalMatchesShippingOnly && expectedMatchesSubtotal) {
    reasons.push("shipping_prepaid_product_cod");
    return {
      productPaidAtCheckout,
      shippingPaidAtCheckout: true,
      reasons,
    };
  }

  if (expectedMatchesSubtotal && !expectedMatchesSubtotalPlusShipping) {
    reasons.push("cod_product_only_shipping_unpaid");
  } else if (expectedMatchesSubtotalPlusShipping || amountsApprox(expected, total)) {
    reasons.push("cod_product_and_shipping_unpaid");
  }

  return {
    productPaidAtCheckout,
    shippingPaidAtCheckout: false,
    reasons,
  };
}

function deriveExpectedCodAmounts(
  productPaidAtCheckout: boolean,
  shippingPaidAtCheckout: boolean,
  subtotal: number,
  shipping: number,
): { expectedCodProduct: number; expectedCodShipping: number } {
  return {
    expectedCodProduct: productPaidAtCheckout ? 0 : subtotal,
    expectedCodShipping: shippingPaidAtCheckout ? 0 : shipping,
  };
}

function deriveCodAmount(
  productPaidAtCheckout: boolean,
  subtotal: number,
  expected: number,
  ambiguous: boolean,
): number | null {
  if (productPaidAtCheckout) return null;
  if (ambiguous) {
    const inferred =
      expected > 0 && expected <= subtotal + AMOUNT_TOLERANCE ? expected : subtotal > 0 ? subtotal : expected;
    return inferred > 0 ? inferred : null;
  }
  return subtotal > 0 ? subtotal : null;
}

function deriveSuggestedFlete(
  shippingPaidAtCheckout: boolean,
  shipping: number,
  expectedMatchesSubtotal: boolean,
): number | null {
  if (shippingPaidAtCheckout && shipping > 0) return shipping;
  if (expectedMatchesSubtotal) return null;
  if (shipping > 0) return shipping;
  return null;
}

function deriveSuggestedEscenario(
  smartEligible: boolean,
  productPaidAtCheckout: boolean,
  escenarioOverride: FlipyEscenarioPago | null,
): FlipyEscenarioPago | null {
  if (escenarioOverride) return escenarioOverride;
  if (smartEligible && productPaidAtCheckout) return "1A";
  return "1E";
}

function deriveConfidence(
  paymentKind: ShopifyPaymentKind,
  shippingPaidAtCheckout: boolean,
  expectedMatchesSubtotal: boolean,
  expectedMatchesSubtotalPlusShipping: boolean,
  escenarioOverride: FlipyEscenarioPago | null,
  ambiguous: boolean,
): "high" | "medium" | "low" {
  if (ambiguous) return escenarioOverride ? "medium" : "low";
  if (paymentKind === "prepaid" && shippingPaidAtCheckout) return "high";
  if (paymentKind === "prepaid" && !shippingPaidAtCheckout) {
    return escenarioOverride ? "high" : "medium";
  }
  if (expectedMatchesSubtotalPlusShipping || expectedMatchesSubtotal) {
    return escenarioOverride ? "high" : expectedMatchesSubtotal ? "medium" : "high";
  }
  return escenarioOverride ? "medium" : "low";
}

/**
 * Map Shopify order amounts + payment signals → suggested Flipy escenario.
 * See docs/FLIPY_CODTRACKED_ALIGNMENT_V0.2.md (D3/D4) and docs/FLIPY_F0_SHOPIFY_PAYMENT_CASES.md.
 */
export function resolveShopifyFlipyPayment(input: FlipyOrderPaymentInput): FlipyPaymentResolution {
  const reasons: string[] = [];
  const pickupKeywords = (input.pickup_keywords ?? []).map((entry) => entry.trim()).filter(Boolean);
  const fulfillmentMode = detectShippingFulfillmentMode(input.shipping_lines, pickupKeywords);
  const escenarioOverride = parseEscenarioOverride(input.note_attributes);

  if (fulfillmentMode === "pickup") {
    reasons.push("shipping_line_indicates_pickup");
    return {
      fulfillmentMode: "pickup",
      productPaidAtCheckout: false,
      shippingPaidAtCheckout: false,
      smartEligible: false,
      flipyFulfillmentMode: null,
      expectedCodProduct: 0,
      expectedCodShipping: 0,
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
  const partial = resolvePartialPaymentSignals(input, paymentKind);
  reasons.push(...partial.reasons);

  const { productPaidAtCheckout, shippingPaidAtCheckout } = partial;
  const smartEligible = shippingPaidAtCheckout === true;
  const flipyFulfillmentMode: FlipyOperationalFulfillmentMode = smartEligible ? "smart" : "bid";

  const { expectedCodProduct, expectedCodShipping } = deriveExpectedCodAmounts(
    productPaidAtCheckout,
    shippingPaidAtCheckout,
    subtotal,
    shipping,
  );

  const expectedMatchesSubtotal = amountsApprox(expected, subtotal);
  const expectedMatchesSubtotalPlusShipping = amountsApprox(expected, subtotal + shipping);
  const ambiguous =
    paymentKind === "cod" &&
    !expectedMatchesSubtotal &&
    !expectedMatchesSubtotalPlusShipping &&
    !amountsApprox(expected, total);

  const suggestedEscenario = deriveSuggestedEscenario(
    smartEligible,
    productPaidAtCheckout,
    escenarioOverride,
  );
  const codAmount = deriveCodAmount(
    productPaidAtCheckout,
    subtotal,
    expected,
    ambiguous,
  );
  const suggestedFlete = deriveSuggestedFlete(
    shippingPaidAtCheckout,
    shipping,
    expectedMatchesSubtotal,
  );
  const confidence = deriveConfidence(
    paymentKind,
    shippingPaidAtCheckout,
    expectedMatchesSubtotal,
    expectedMatchesSubtotalPlusShipping,
    escenarioOverride,
    ambiguous,
  );

  if (escenarioOverride) reasons.push("note_attribute_escenario_override");
  if (ambiguous) reasons.push("amounts_ambiguous_confirm_required");
  if (smartEligible) reasons.push("smart_eligible_shipping_prepaid");
  else reasons.push("bid_mode_shipping_not_prepaid");

  const requiresUserConfirmation =
    escenarioOverride != null
      ? false
      : ambiguous ||
        confidence !== "high" ||
        paymentKind === "cod" ||
        (paymentKind === "prepaid" && !shippingPaidAtCheckout);

  return {
    fulfillmentMode,
    productPaidAtCheckout,
    shippingPaidAtCheckout,
    smartEligible,
    flipyFulfillmentMode,
    expectedCodProduct,
    expectedCodShipping,
    suggestedEscenario,
    codAmount,
    suggestedFlete,
    confidence,
    requiresUserConfirmation,
    reasons,
  };
}
