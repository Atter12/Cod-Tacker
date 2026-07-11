/**
 * Domain effects for collected vs settled COD.
 *
 * - Confirming a collected match → collected_cod_amount / cash_collected payment.
 * - Approving/liquidating a batch → settled_cod_amount / settled payment.
 * Delivered logistics status is NEVER set here.
 */

import type { Enums } from "@/types/database.generated";

export type PaymentStatus = Enums<"payment_status">;

export type OrderPaymentSnapshot = {
  id: string;
  expectedCodAmount: number | null;
  collectedCodAmount: number | null;
  settledCodAmount: number | null;
  paymentStatus: PaymentStatus;
  costOfGoodsAmount: number | null;
  shippingCostAmount: number | null;
  returnCostAmount: number | null;
  feeAmount: number | null;
};

export type ApplyCollectedInput = {
  order: OrderPaymentSnapshot;
  collectedAmount: number;
};

export type ApplySettledInput = {
  order: OrderPaymentSnapshot;
  settledAmount: number;
};

export type PaymentPatch = {
  collected_cod_amount?: number | null;
  settled_cod_amount?: number | null;
  cash_collected_at?: string | null;
  settled_at?: string | null;
  payment_status: PaymentStatus;
  contribution_margin_amount?: number | null;
};

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function computeContributionMargin(input: {
  settledOrCollected: number;
  costOfGoodsAmount: number | null;
  shippingCostAmount: number | null;
  returnCostAmount: number | null;
  feeAmount: number | null;
}): number | null {
  const costs = [
    input.costOfGoodsAmount,
    input.shippingCostAmount,
    input.returnCostAmount,
    input.feeAmount,
  ];
  if (costs.every((c) => c == null)) return null;
  const totalCost = costs.reduce<number>((sum, c) => sum + (c ?? 0), 0);
  return round2(input.settledOrCollected - totalCost);
}

/** Apply COD collected (still not settled/liquidated). */
export function applyCollectedPatch(
  input: ApplyCollectedInput,
  nowIso = new Date().toISOString(),
): PaymentPatch {
  const expected = input.order.expectedCodAmount;
  let payment_status: PaymentStatus = "cash_collected";
  if (expected != null && input.collectedAmount + 0.01 < expected) {
    payment_status = "partially_collected";
  } else if (input.order.paymentStatus === "disputed") {
    payment_status = "disputed";
  }

  const margin = computeContributionMargin({
    settledOrCollected: input.collectedAmount,
    costOfGoodsAmount: input.order.costOfGoodsAmount,
    shippingCostAmount: input.order.shippingCostAmount,
    returnCostAmount: input.order.returnCostAmount,
    feeAmount: input.order.feeAmount,
  });

  return {
    collected_cod_amount: round2(input.collectedAmount),
    cash_collected_at: nowIso,
    payment_status,
    contribution_margin_amount: margin,
  };
}

/** Apply settlement/liquidation after batch approval. */
export function applySettledPatch(
  input: ApplySettledInput,
  nowIso = new Date().toISOString(),
): PaymentPatch {
  const collected = input.order.collectedCodAmount ?? input.settledAmount;
  const margin = computeContributionMargin({
    settledOrCollected: input.settledAmount,
    costOfGoodsAmount: input.order.costOfGoodsAmount,
    shippingCostAmount: input.order.shippingCostAmount,
    returnCostAmount: input.order.returnCostAmount,
    feeAmount: input.order.feeAmount,
  });

  return {
    collected_cod_amount: collected,
    settled_cod_amount: round2(input.settledAmount),
    settled_at: nowIso,
    payment_status: "settled",
    contribution_margin_amount: margin,
  };
}

/**
 * Controlled reopen: revert settled fields only when batch was approved.
 * Does not clear collected unless `clearCollected` is set.
 */
export function applyReopenPatch(
  order: OrderPaymentSnapshot,
  options?: { clearCollected?: boolean },
): PaymentPatch {
  if (options?.clearCollected) {
    return {
      collected_cod_amount: null,
      settled_cod_amount: null,
      cash_collected_at: null,
      settled_at: null,
      payment_status: order.expectedCodAmount ? "cash_expected" : "unpaid",
      contribution_margin_amount: null,
    };
  }

  const collected = order.collectedCodAmount;
  let payment_status: PaymentStatus = "settlement_pending";
  if (collected != null && collected > 0) {
    const expected = order.expectedCodAmount;
    payment_status =
      expected != null && collected + 0.01 < expected ? "partially_collected" : "cash_collected";
  } else if (order.expectedCodAmount) {
    payment_status = "cash_expected";
  } else {
    payment_status = "unpaid";
  }

  return {
    settled_cod_amount: null,
    settled_at: null,
    payment_status,
    contribution_margin_amount: computeContributionMargin({
      settledOrCollected: collected ?? 0,
      costOfGoodsAmount: order.costOfGoodsAmount,
      shippingCostAmount: order.shippingCostAmount,
      returnCostAmount: order.returnCostAmount,
      feeAmount: order.feeAmount,
    }),
  };
}
