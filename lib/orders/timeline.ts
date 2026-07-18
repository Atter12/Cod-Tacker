import {
  conversionOutcome,
  friendlyConversionError,
  labelConversionEventName,
  labelConversionOutcome,
  labelConversionPlatform,
} from "@/lib/conversions/labels";
import { labelConfirmationStatus, labelOrderStatus, labelPaymentStatus } from "@/lib/orders/labels";
import type { OrderDetailBundle, OrderTimelineItem } from "@/types/orders";

export function buildOrderTimeline(
  bundle: Omit<OrderDetailBundle, "timeline">,
): OrderTimelineItem[] {
  const items: OrderTimelineItem[] = [];
  const { order } = bundle;

  items.push({
    id: `order-created-${order.id}`,
    kind: "status",
    title: "Pedido importado",
    description: `Estado inicial: ${labelOrderStatus(order.order_status)}`,
    occurredAt: order.created_at_source || order.created_at,
  });

  for (const row of bundle.statusHistory) {
    items.push({
      id: `history-${row.id}`,
      kind: "status",
      title: `Estado → ${labelOrderStatus(row.new_status)}`,
      description: row.reason_detail ?? row.reason_code ?? undefined,
      occurredAt: row.occurred_at,
      meta: { previous: row.previous_status },
    });
  }

  if (order.confirmed_at) {
    items.push({
      id: `confirmed-${order.id}`,
      kind: "confirmation",
      title: "Pedido confirmado",
      description: labelConfirmationStatus(order.confirmation_status),
      occurredAt: order.confirmed_at,
    });
  }

  if (order.cash_collected_at) {
    items.push({
      id: `cash-${order.id}`,
      kind: "payment",
      title: "Cobro registrado",
      description: labelPaymentStatus(order.payment_status),
      occurredAt: order.cash_collected_at,
    });
  }

  if (order.settled_at) {
    items.push({
      id: `settled-${order.id}`,
      kind: "settlement",
      title: "Conciliación registrada",
      occurredAt: order.settled_at,
    });
  }

  for (const shipment of bundle.shipments) {
    items.push({
      id: `shipment-${shipment.id}`,
      kind: "shipment",
      title: `Envío ${shipment.tracking_number ?? shipment.id.slice(0, 8)}`,
      description: shipment.status,
      occurredAt: shipment.created_at,
    });
  }

  for (const event of bundle.shipmentEvents) {
    items.push({
      id: `ship-event-${event.id}`,
      kind: "shipment",
      title: event.external_status_label ?? event.normalized_status,
      description: event.location_text ?? undefined,
      occurredAt: event.occurred_at,
    });
  }

  for (const attr of bundle.attributions) {
    items.push({
      id: `attr-${attr.id}`,
      kind: "attribution",
      title: attr.is_primary ? "Atribución principal" : "Atribución",
      description: `${attr.platform} · ${attr.model}`,
      occurredAt: attr.calculated_at,
    });
  }

  for (const conversion of bundle.conversionEvents) {
    const outcome = conversionOutcome(conversion);
    items.push({
      id: `conv-${conversion.id}`,
      kind: "conversion",
      title: `Conversión ${labelConversionEventName(conversion.event_name)} · ${labelConversionOutcome(outcome)}`,
      description: `${labelConversionPlatform(conversion.platform)}${
        outcome === "failed"
          ? ` · ${friendlyConversionError(conversion.last_error_message) ?? "No se pudo enviar"}`
          : ""
      }`,
      occurredAt: conversion.sent_at || conversion.event_time,
      meta: { outcome, status: conversion.status },
    });
  }

  for (const message of bundle.whatsappMessages) {
    items.push({
      id: `wa-${message.id}`,
      kind: "whatsapp",
      title: `WhatsApp (${message.direction})`,
      description: message.body?.slice(0, 120) ?? message.message_type,
      occurredAt: message.sent_at ?? message.received_at ?? message.created_at,
    });
  }

  for (const note of bundle.notes) {
    items.push({
      id: `note-${note.id}`,
      kind: "note",
      title: "Nota interna",
      description: note.body.slice(0, 160),
      occurredAt: note.created_at,
    });
  }

  for (const alert of bundle.alerts) {
    items.push({
      id: `alert-${alert.id}`,
      kind: "alert",
      title: alert.title,
      description: alert.body ?? undefined,
      occurredAt: alert.created_at,
    });
  }

  for (const log of bundle.auditLogs) {
    items.push({
      id: `audit-${log.id}`,
      kind: "audit",
      title: `Auditoría: ${log.action}`,
      occurredAt: log.created_at,
    });
  }

  for (const raw of bundle.rawEvents) {
    items.push({
      id: `raw-${raw.id}`,
      kind: "raw_event",
      title: `Evento crudo ${raw.provider}/${raw.event_type}`,
      description: raw.status,
      occurredAt: raw.occurred_at ?? raw.received_at,
    });
  }

  return items.sort((a, b) => Date.parse(b.occurredAt) - Date.parse(a.occurredAt));
}
