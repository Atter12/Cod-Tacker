import "server-only";

import {
  shouldFirePurchaseOnDelivered,
  shouldMarkCashCollectedOnDelivered,
} from "@/lib/conversions/delivered-purchase-policy";
import {
  recordPurchaseConversionEvent,
  type RecordPurchaseConversionResult,
} from "@/lib/conversions/record-purchase-conversion";
import { logger } from "@/lib/observability/logger";
import type { JobsAdminClient } from "@/lib/jobs/types";
import type { Enums } from "@/types/database.generated";

type PaymentStatus = Enums<"payment_status">;

export {
  isNewlyDeliveredTerminal,
  shouldFirePurchaseOnDelivered,
  shouldMarkCashCollectedOnDelivered,
} from "@/lib/conversions/delivered-purchase-policy";

/**
 * S11: after a shipment reaches delivered, record Purchase CAPI for COD orders
 * (same event_id dedupe as manual cash_collected / reconciliation).
 * Does not fire on RTO / prepaid-only paths.
 */
export async function maybeRecordPurchaseOnDelivered(input: {
  admin: JobsAdminClient;
  agencyId: string;
  storeId: string;
  orderId: string;
  deliveredAt: string;
  shipmentId: string;
  jobId?: string;
}): Promise<{
  attempted: boolean;
  skippedReason?: string;
  conversion?: RecordPurchaseConversionResult;
}> {
  const orderRes = await input.admin
    .from("orders")
    .select(
      "id, payment_status, expected_cod_amount, collected_cod_amount, total_amount, currency_code",
    )
    .eq("id", input.orderId)
    .eq("store_id", input.storeId)
    .maybeSingle();

  if (orderRes.error || !orderRes.data) {
    logger.warn("conversion.delivered.order_not_found", {
      order_id: input.orderId,
      store_id: input.storeId,
      shipment_id: input.shipmentId,
    });
    return { attempted: false, skippedReason: "order_not_found" };
  }

  const order = orderRes.data;
  if (!shouldFirePurchaseOnDelivered(order.payment_status)) {
    logger.info("conversion.delivered.skip_non_cod", {
      order_id: order.id,
      payment_status: order.payment_status,
      shipment_id: input.shipmentId,
    });
    return { attempted: false, skippedReason: `payment_status:${order.payment_status}` };
  }

  if (shouldMarkCashCollectedOnDelivered(order.payment_status)) {
    const collected =
      order.collected_cod_amount ?? order.expected_cod_amount ?? order.total_amount ?? 0;
    const patch = await input.admin
      .from("orders")
      .update({
        payment_status: "cash_collected" satisfies PaymentStatus,
        cash_collected_at: input.deliveredAt,
        collected_cod_amount: collected,
      })
      .eq("id", order.id)
      .eq("store_id", input.storeId);
    if (patch.error) {
      logger.warn("conversion.delivered.cash_mark_failed", {
        order_id: order.id,
        error: patch.error.message,
      });
    }
  }

  const value = Number(
    order.collected_cod_amount ?? order.expected_cod_amount ?? order.total_amount ?? 0,
  );

  try {
    const conversion = await recordPurchaseConversionEvent({
      admin: input.admin,
      agencyId: input.agencyId,
      storeId: input.storeId,
      orderId: order.id,
      value,
      currencyCode: order.currency_code || "PEN",
      eventTime: input.deliveredAt,
      source: "delivered",
    });

    logger.info("conversion.delivered.recorded", {
      order_id: order.id,
      shipment_id: input.shipmentId,
      job_id: input.jobId ?? null,
      event_id: conversion.eventId,
      delivery_status: conversion.deliveryStatus,
      capi_mode: conversion.capiMode,
    });

    return { attempted: true, conversion };
  } catch (err) {
    logger.warn("conversion.delivered.record_failed", {
      order_id: order.id,
      shipment_id: input.shipmentId,
      error: err instanceof Error ? err.message : "conversion_failed",
    });
    return { attempted: true, skippedReason: "record_failed" };
  }
}
