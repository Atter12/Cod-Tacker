/**
 * Detect COD vs prepaid from Shopify order signals (shared by webhook + GraphQL).
 *
 * Rules (CODTracked ICP = COD-first):
 * 1. Explicit COD tag/gateway → COD
 * 2. Explicit prepaid/online gateway or paid financial without COD → prepaid
 * 3. Ambiguous → COD (cash_expected)
 * Refunded/voided financial → payment_status refunded, no COD expected.
 */

export type ShopifyPaymentKind = "cod" | "prepaid";

export type ShopifyMappedPayment = {
  payment_kind: ShopifyPaymentKind;
  /** Initial ingest statuses only — lifecycle statuses are owned by ops/reconciliation. */
  payment_status: "cash_expected" | "unpaid" | "refunded";
  expected_cod_amount: number | null;
};

const COD_TEXT =
  /\b(cod|c\.o\.d|cash[_\s-]?on[_\s-]?delivery|contra\s*entrega|contraentrega|pago\s*contra\s*entrega)\b/i;

const PREPAID_TAG = /\b(prepaid|pre[_\s-]?paid|paid[_\s-]?online|pagado\s*online|pago\s*online)\b/i;

const PREPAID_GATEWAY =
  /\b(shopify[_\s-]?payments|paypal|stripe|mercado\s*pago|mercadopago|niubiz|culqi|openpay|kushki|visa|mastercard|amex|apple\s*pay|google\s*pay|manual)\b/i;

function normalizeTags(tags: string[] | string | null | undefined): string[] {
  if (Array.isArray(tags)) {
    return tags.map((t) => String(t).trim()).filter(Boolean);
  }
  if (typeof tags === "string" && tags.trim()) {
    return tags.split(",").map((t) => t.trim()).filter(Boolean);
  }
  return [];
}

function normalizeGateways(
  names: string[] | string | null | undefined,
  gateway?: string | null,
): string[] {
  const out: string[] = [];
  if (Array.isArray(names)) {
    for (const n of names) {
      const v = String(n).trim();
      if (v) out.push(v);
    }
  } else if (typeof names === "string" && names.trim()) {
    out.push(names.trim());
  }
  if (gateway && gateway.trim()) out.push(gateway.trim());
  return out;
}

function hasCodSignal(tags: string[], gateways: string[]): boolean {
  if (tags.some((t) => COD_TEXT.test(t))) return true;
  if (gateways.some((g) => COD_TEXT.test(g))) return true;
  return false;
}

function hasPrepaidSignal(tags: string[], gateways: string[]): boolean {
  if (tags.some((t) => PREPAID_TAG.test(t))) return true;
  // "manual" alone is ambiguous in LATAM COD; only count as prepaid with other prepaid cues
  // or when no COD cue and financial is paid (handled below). For gateways:
  for (const g of gateways) {
    if (COD_TEXT.test(g)) continue;
    if (PREPAID_GATEWAY.test(g) && !/^manual$/i.test(g.trim())) return true;
  }
  return false;
}

export function mapShopifyPayment(input: {
  financialStatus?: string | null;
  tags?: string[] | string | null;
  paymentGatewayNames?: string[] | string | null;
  gateway?: string | null;
  totalAmount: number;
}): ShopifyMappedPayment {
  const financial = (input.financialStatus ?? "").toUpperCase().replace(/\s+/g, "_");
  const tags = normalizeTags(input.tags);
  const gateways = normalizeGateways(input.paymentGatewayNames, input.gateway);
  const total = Number.isFinite(input.totalAmount) ? Math.max(0, input.totalAmount) : 0;

  if (financial === "REFUNDED" || financial === "VOIDED") {
    return {
      payment_kind: hasCodSignal(tags, gateways) ? "cod" : "prepaid",
      payment_status: "refunded",
      expected_cod_amount: null,
    };
  }

  const codSignal = hasCodSignal(tags, gateways);
  const prepaidSignal = hasPrepaidSignal(tags, gateways);
  const financiallyPaid = financial === "PAID" || financial === "PARTIALLY_PAID";

  // Explicit COD always wins (including when Shopify marks paid incorrectly).
  if (codSignal) {
    return {
      payment_kind: "cod",
      payment_status: "cash_expected",
      expected_cod_amount: total,
    };
  }

  if (prepaidSignal || financiallyPaid) {
    return {
      payment_kind: "prepaid",
      payment_status: "unpaid",
      expected_cod_amount: null,
    };
  }

  // COD-first default for ambiguous Shopify COD checkouts (often pending + empty gateway).
  return {
    payment_kind: "cod",
    payment_status: "cash_expected",
    expected_cod_amount: total,
  };
}

/** Payment statuses owned by ops/reconciliation — Shopify sync must not overwrite them. */
export const SHOPIFY_PAYMENT_LOCKED_STATUSES = new Set([
  "cash_collected",
  "partially_collected",
  "settlement_pending",
  "settled",
  "disputed",
  "refunded",
  "written_off",
]);

export function shouldApplyShopifyPaymentSync(currentPaymentStatus: string | null | undefined): boolean {
  if (!currentPaymentStatus) return true;
  return !SHOPIFY_PAYMENT_LOCKED_STATUSES.has(currentPaymentStatus);
}
