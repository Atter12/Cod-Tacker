/**
 * Business gate for Confirmar cobrado / cobro parcial.
 *
 * Controlled MVP:
 * - remesa (neto+fee) alone or accumulated must not exceed Shopify COD/total
 * - exact match (±tol) → full cash_collected
 * - under Shopify → partially_collected allowed (later remesas anexan al mismo pedido)
 * - over Shopify → blocked
 */

export const COLLECTED_SHOPIFY_TOLERANCE = 0.01;

export type ShopifyCodOrderSnapshot = {
  expectedCodAmount: number | null;
  totalAmount: number | null;
  currencyCode: string | null;
  /** Already applied collected COD on the order (from prior remesas). */
  collectedCodAmount?: number | null;
};

export type CollectedRemesaGateInput = {
  /** Gross remitted from this settlement row (neto + fee). */
  remesaAmount: number;
  itemCurrency: string | null | undefined;
  order: ShopifyCodOrderSnapshot;
};

export type CollectedRemesaGateResult =
  | {
      ok: true;
      mode: "full" | "partial";
      shopifyExpected: number;
      remesaAmount: number;
      previousCollected: number;
      newCollected: number;
      remainingAfter: number;
    }
  | { ok: false; error: string };

/** @deprecated Use CollectedRemesaGateInput — kept for call-site migration clarity. */
export type CollectedAmountGateInput = {
  collectedAmount: number;
  itemCurrency: string | null | undefined;
  order: ShopifyCodOrderSnapshot;
};

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function normCurrency(code: string | null | undefined): string | null {
  const t = code?.trim().toUpperCase();
  return t || null;
}

/** Prefer COD esperado; fall back to Shopify order total when COD is missing. */
export function resolveShopifyExpectedAmount(order: ShopifyCodOrderSnapshot): number | null {
  if (order.expectedCodAmount != null && order.expectedCodAmount > 0) {
    return round2(order.expectedCodAmount);
  }
  if (order.totalAmount != null && order.totalAmount > 0) {
    return round2(order.totalAmount);
  }
  return null;
}

export function gateConfirmCollectedRemesa(
  input: CollectedRemesaGateInput,
): CollectedRemesaGateResult {
  const shopifyExpected = resolveShopifyExpectedAmount(input.order);
  if (shopifyExpected == null) {
    return {
      ok: false,
      error:
        "El pedido no tiene COD esperado ni total Shopify > 0. Corrige el pedido antes de confirmar cobro.",
    };
  }

  const itemCurrency = normCurrency(input.itemCurrency);
  const orderCurrency = normCurrency(input.order.currencyCode);
  if (itemCurrency && orderCurrency && itemCurrency !== orderCurrency) {
    return {
      ok: false,
      error: `Moneda del lote (${itemCurrency}) distinta a la del pedido Shopify (${orderCurrency}).`,
    };
  }

  const remesaAmount = round2(input.remesaAmount);
  if (remesaAmount <= 0) {
    return { ok: false, error: "La remesa de la fila debe ser mayor a 0." };
  }

  const previousCollected = round2(Math.max(0, input.order.collectedCodAmount ?? 0));
  const newCollected = round2(previousCollected + remesaAmount);
  const remainingAfter = round2(shopifyExpected - newCollected);

  if (newCollected > shopifyExpected + COLLECTED_SHOPIFY_TOLERANCE) {
    return {
      ok: false,
      error: `La remesa (${remesaAmount}) sumada al cobrado (${previousCollected}) supera Shopify (${shopifyExpected}). No se aceptan cobros de más.`,
    };
  }

  if (Math.abs(newCollected - shopifyExpected) <= COLLECTED_SHOPIFY_TOLERANCE) {
    return {
      ok: true,
      mode: "full",
      shopifyExpected,
      remesaAmount,
      previousCollected,
      newCollected: shopifyExpected,
      remainingAfter: 0,
    };
  }

  return {
    ok: true,
    mode: "partial",
    shopifyExpected,
    remesaAmount,
    previousCollected,
    newCollected,
    remainingAfter,
  };
}

/**
 * Back-compat wrapper: treats `collectedAmount` as the remesa with no prior collected
 * unless `order.collectedCodAmount` is set.
 */
export function gateConfirmCollectedAmount(
  input: CollectedAmountGateInput,
): CollectedRemesaGateResult {
  return gateConfirmCollectedRemesa({
    remesaAmount: input.collectedAmount,
    itemCurrency: input.itemCurrency,
    order: input.order,
  });
}
