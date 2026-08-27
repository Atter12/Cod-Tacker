import "server-only";

import { recordPurchaseConversionEvent } from "@/lib/conversions/record-purchase-conversion";
import { mergeFlipyFletePaymentIntoMetadata } from "@/lib/integrations/flipy/flete-payment-status";
import { logger } from "@/lib/observability/logger";
import { applyCollectedPatch } from "@/lib/reconciliation/effects";
import { gateConfirmCollectedRemesa } from "@/lib/reconciliation/collected-gate";
import type { JobsAdminClient } from "@/lib/jobs/types";
import type { Enums, Json } from "@/types/database.generated";

type MatchedItemRef = {
  id: string;
  order_id: string | null;
  match_status: string | null;
  settled_amount: number;
  fee_amount: number;
  currency_code: string | null;
  collected_applied_at: string | null;
};

/**
 * Auto-apply cash_collected for Flipy-sourced matched settlement items.
 * Skips difference/unmatched; never sets logistics delivered.
 */
export async function applyFlipyAutoCollectedForBatch(input: {
  admin: JobsAdminClient;
  agencyId: string;
  storeId: string;
  batchId: string;
}): Promise<{ applied: number; skipped: number }> {
  const itemsRes = await input.admin
    .from("settlement_items")
    .select(
      "id, order_id, match_status, settled_amount, fee_amount, currency_code, collected_applied_at",
    )
    .eq("store_id", input.storeId)
    .eq("batch_id", input.batchId);

  if (itemsRes.error) {
    logger.warn("flipy.settlement.auto_collected_load_failed", {
      batch_id: input.batchId,
      error: itemsRes.error.message,
    });
    return { applied: 0, skipped: 0 };
  }

  let applied = 0;
  let skipped = 0;

  for (const item of (itemsRes.data ?? []) as MatchedItemRef[]) {
    if (item.collected_applied_at) {
      skipped += 1;
      continue;
    }
    if (item.match_status !== "matched" || !item.order_id) {
      skipped += 1;
      continue;
    }

    const orderRes = await input.admin
      .from("orders")
      .select(
        "id, expected_cod_amount, collected_cod_amount, settled_cod_amount, payment_status, cost_of_goods_amount, shipping_cost_amount, return_cost_amount, currency_code, total_amount, metadata",
      )
      .eq("id", item.order_id)
      .eq("store_id", input.storeId)
      .maybeSingle();

    if (orderRes.error || !orderRes.data) {
      skipped += 1;
      continue;
    }

    const order = orderRes.data;
    if (
      order.payment_status === "cash_collected" ||
      order.payment_status === "settlement_pending" ||
      order.payment_status === "settled"
    ) {
      const fleteMeta = mergeFlipyFletePaymentIntoMetadata(order.metadata as Json, {
        status: "collected",
        via: "settlement",
      });
      await input.admin
        .from("orders")
        .update({ metadata: fleteMeta as Json, updated_at: new Date().toISOString() })
        .eq("id", order.id)
        .eq("store_id", input.storeId);
      await input.admin
        .from("settlement_items")
        .update({ collected_applied_at: new Date().toISOString() })
        .eq("id", item.id)
        .eq("store_id", input.storeId);
      skipped += 1;
      continue;
    }

    const remesaAmount = Number(item.settled_amount) + Number(item.fee_amount);
    const gate = gateConfirmCollectedRemesa({
      remesaAmount,
      itemCurrency: item.currency_code,
      order: {
        expectedCodAmount: order.expected_cod_amount,
        totalAmount: order.total_amount,
        currencyCode: order.currency_code,
        collectedCodAmount: order.collected_cod_amount,
      },
    });
    if (!gate.ok) {
      skipped += 1;
      continue;
    }

    const patch = applyCollectedPatch({
      order: {
        id: order.id,
        expectedCodAmount: order.expected_cod_amount,
        collectedCodAmount: order.collected_cod_amount,
        settledCodAmount: order.settled_cod_amount,
        paymentStatus: order.payment_status as Enums<"payment_status">,
        costOfGoodsAmount: order.cost_of_goods_amount,
        shippingCostAmount: order.shipping_cost_amount,
        returnCostAmount: order.return_cost_amount,
        feeAmount: null,
      },
      collectedAmount: gate.newCollected,
    });

    const fleteMeta = mergeFlipyFletePaymentIntoMetadata(order.metadata as Json, {
      status: "collected",
      via: "settlement",
    });

    const upd = await input.admin
      .from("orders")
      .update({ ...patch, metadata: fleteMeta as Json })
      .eq("id", order.id)
      .eq("store_id", input.storeId);
    if (upd.error) {
      skipped += 1;
      continue;
    }

    await input.admin
      .from("settlement_items")
      .update({ collected_applied_at: new Date().toISOString() })
      .eq("id", item.id)
      .eq("store_id", input.storeId);

    if (gate.mode === "full") {
      try {
        await recordPurchaseConversionEvent({
          admin: input.admin,
          agencyId: input.agencyId,
          storeId: input.storeId,
          orderId: order.id,
          value: Number(patch.collected_cod_amount ?? gate.newCollected),
          currencyCode: order.currency_code || "PEN",
          eventTime: patch.cash_collected_at ?? undefined,
          source: "reconciliation",
        });
      } catch (convErr) {
        logger.warn("flipy.settlement.conversion_record_failed", {
          order_id: order.id,
          error: convErr instanceof Error ? convErr.message : "conversion_failed",
        });
      }
    }

    applied += 1;
  }

  return { applied, skipped };
}
