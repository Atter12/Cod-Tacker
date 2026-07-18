import {
  labelAuditAction,
  labelAttributionModel,
  labelConfirmationStatus,
  labelOrderStatus,
  labelPaymentStatus,
  labelPlatform,
  labelShipmentStatus,
} from "@/lib/orders/labels";
import type { OrderDetailBundle, OrderTimelineItem } from "@/types/orders";
import type { Json } from "@/types/database.generated";

export type ConversionChannelOutcome = "live" | "failed" | "dry_run" | "sent";

export type ConversionChannelSummary = {
  name: "meta" | "tiktok";
  mode?: string;
  ok?: boolean;
  outcome: ConversionChannelOutcome;
};

function channelOutcome(channel: {
  mode?: string;
  ok?: boolean;
}): ConversionChannelOutcome {
  if (channel.mode === "dry_run") return "dry_run";
  if (channel.ok === true) return "live";
  if (channel.ok === false) return "failed";
  return (channel.mode as ConversionChannelOutcome | undefined) ?? "sent";
}

/**
 * Read per-channel Meta/TikTok send outcomes from conversion_events.custom_data.
 * One DB row can (and usually does) cover both platforms.
 */
export function parseConversionChannels(
  customData: Json | null | undefined,
): ConversionChannelSummary[] {
  const bag =
    customData && typeof customData === "object" && !Array.isArray(customData)
      ? (customData as Record<string, unknown>)
      : null;
  if (!bag) return [];

  const channels: ConversionChannelSummary[] = [];
  for (const name of ["meta", "tiktok"] as const) {
    const raw = bag[name];
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) continue;
    const entry = raw as Record<string, unknown>;
    if (!("mode" in entry) && !("ok" in entry) && !("missing_credentials" in entry)) continue;
    const mode = typeof entry.mode === "string" ? entry.mode : undefined;
    const ok = typeof entry.ok === "boolean" ? entry.ok : undefined;
    channels.push({
      name,
      mode,
      ok,
      outcome: channelOutcome({ mode, ok }),
    });
  }
  return channels;
}

function channelOutcomeLabelEs(outcome: ConversionChannelOutcome): string {
  switch (outcome) {
    case "live":
    case "sent":
      return "enviado";
    case "failed":
      return "falló";
    case "dry_run":
      return "prueba";
  }
}

/** Prefer dual Meta+TikTok labels from custom_data (S12); fall back to platform column. */
export function formatConversionTimelineDescription(conversion: {
  platform: string;
  custom_data?: Json;
  status?: string;
}): string {
  const channels = parseConversionChannels(conversion.custom_data);

  if (channels.length === 0) {
    const platform = labelPlatform(conversion.platform);
    if (!conversion.status) return platform;
    const statusLabel =
      conversion.status === "sent"
        ? "enviado"
        : conversion.status === "failed"
          ? "falló"
          : conversion.status === "queued"
            ? "en cola"
            : conversion.status;
    return `${platform} · ${statusLabel}`;
  }

  return channels
    .map((channel) => `${labelPlatform(channel.name)} · ${channelOutcomeLabelEs(channel.outcome)}`)
    .join(" · ");
}

function labelConversionEventName(eventName: string): string {
  return eventName === "Purchase" ? "Compra" : eventName;
}

function labelWhatsappDirection(direction: string): string {
  if (direction === "inbound") return "entrante";
  if (direction === "outbound") return "saliente";
  return direction;
}

/** Audit actions already covered by a clearer business timeline item. */
const REDUNDANT_AUDIT_ACTIONS = new Set([
  "order_payment_status_changed",
  "order_note_added",
]);

/**
 * Client-facing order history: business events in Spanish.
 * Omits raw webhook noise (still available under Auditoría / ops tooling).
 */
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
      description: labelShipmentStatus(shipment.status),
      occurredAt: shipment.created_at,
    });
  }

  for (const event of bundle.shipmentEvents) {
    const statusLabel = labelShipmentStatus(
      event.normalized_status || event.external_status_label || event.external_status_code,
    );
    items.push({
      id: `ship-event-${event.id}`,
      kind: "shipment",
      title: `Actualización de envío: ${statusLabel}`,
      description: event.location_text ?? undefined,
      occurredAt: event.occurred_at,
    });
  }

  for (const attr of bundle.attributions) {
    items.push({
      id: `attr-${attr.id}`,
      kind: "attribution",
      title: attr.is_primary ? "Atribución principal" : "Atribución",
      description: `${labelPlatform(attr.platform)} · ${labelAttributionModel(attr.model)}`,
      occurredAt: attr.calculated_at,
    });
  }

  for (const conversion of bundle.conversionEvents) {
    items.push({
      id: `conv-${conversion.id}`,
      kind: "conversion",
      title: `Aviso de conversión · ${labelConversionEventName(conversion.event_name)}`,
      description: formatConversionTimelineDescription(conversion),
      occurredAt: conversion.event_time,
    });
  }

  for (const message of bundle.whatsappMessages) {
    items.push({
      id: `wa-${message.id}`,
      kind: "whatsapp",
      title: `WhatsApp (${labelWhatsappDirection(message.direction)})`,
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
    // Prefer the clearer business items (Cobro registrado, Nota interna, …).
    if (REDUNDANT_AUDIT_ACTIONS.has(log.action)) continue;
    items.push({
      id: `audit-${log.id}`,
      kind: "audit",
      title: labelAuditAction(log.action),
      occurredAt: log.created_at,
    });
  }

  // Raw webhook events (shopify/envia … processed) are ops noise — omitted from client Historial.

  return items.sort((a, b) => Date.parse(b.occurredAt) - Date.parse(a.occurredAt));
}
