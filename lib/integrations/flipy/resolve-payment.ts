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

export type FlipyOrderPaymentInput = {
  payment_kind?: ShopifyPaymentKind | null;
  subtotal_amount?: number | null;
  shipping_amount?: number | null;
  total_amount?: number | null;
  expected_cod_amount?: number | null;
  shipping_lines?: Array<FlipyShippingLineInput | null> | null;
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
  return value.replace(/[_-]+/g, " ");
}

function isPickupShippingLine(line: FlipyShippingLineInput | null | undefined): boolean {
  if (!line) return false;
  const title = normalizePickupText(line.title?.trim() ?? "");
  const code = normalizePickupText(line.code?.trim() ?? "");
  return PICKUP_TEXT.test(title) || PICKUP_TEXT.test(code);
}

function detectFulfillmentMode(
  shippingLines: Array<FlipyShippingLineInput | null> | null | undefined,
): "delivery" | "pickup" | "unknown" {
  if (!Array.isArray(shippingLines) || shippingLines.length === 0) return "unknown";
  if (shippingLines.some((line) => isPickupShippingLine(line))) return "pickup";
  return "delivery";
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
  const fulfillmentMode = detectFulfillmentMode(input.shipping_lines);

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
      return {
        fulfillmentMode,
        productPaidAtCheckout: true,
        shippingPaidAtCheckout: true,
        suggestedEscenario: "1A",
        codAmount: null,
        suggestedFlete: shipping,
        confidence: "high",
        requiresUserConfirmation: false,
        reasons,
      };
    }

    reasons.push("prepaid_zero_shipping_confirm_flete");
    return {
      fulfillmentMode,
      productPaidAtCheckout: true,
      shippingPaidAtCheckout: false,
      suggestedEscenario: "1A",
      codAmount: null,
      suggestedFlete: null,
      confidence: "medium",
      requiresUserConfirmation: true,
      reasons,
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
      suggestedEscenario: "1E",
      codAmount: subtotal > 0 ? subtotal : null,
      suggestedFlete: shipping > 0 ? shipping : null,
      confidence: "high",
      requiresUserConfirmation: true,
      reasons,
    };
  }

  if (expectedMatchesSubtotal) {
    reasons.push("expected_matches_subtotal_only");
    return {
      fulfillmentMode,
      productPaidAtCheckout: false,
      shippingPaidAtCheckout: false,
      suggestedEscenario: "1E",
      codAmount: subtotal,
      suggestedFlete: null,
      confidence: "medium",
      requiresUserConfirmation: true,
      reasons,
    };
  }

  reasons.push("amounts_ambiguous_confirm_required");
  const inferredCod =
    expected > 0 && expected <= subtotal ? expected : subtotal > 0 ? subtotal : expected;

  return {
    fulfillmentMode,
    productPaidAtCheckout: false,
    shippingPaidAtCheckout: false,
    suggestedEscenario: "1E",
    codAmount: inferredCod > 0 ? inferredCod : null,
    suggestedFlete: shipping > 0 ? shipping : null,
    confidence: "low",
    requiresUserConfirmation: true,
    reasons,
  };
}
