/** Spanish labels for alerts and automations. */

export const ALERT_SEVERITY_LABELS: Record<string, string> = {
  info: "Info",
  warning: "Advertencia",
  critical: "Crítica",
};

export const ALERT_STATUS_LABELS: Record<string, string> = {
  open: "Abierta",
  acknowledged: "Reconocida",
  resolved: "Resuelta",
  silenced: "Silenciada",
  reopened: "Reabierta",
};

export function labelAlertSeverity(s: string) {
  return ALERT_SEVERITY_LABELS[s] ?? s;
}

export function labelAlertStatus(s: string) {
  return ALERT_STATUS_LABELS[s] ?? s;
}

/** Ack, silence, and resolve stop a new notification for the same alert. */
export function shouldNotifyAlert(row: {
  status?: string | null;
  resolved_at?: string | null;
  acknowledged_at?: string | null;
  silenced_until?: string | null;
}, now = Date.now()): boolean {
  if (row.resolved_at || row.acknowledged_at) return false;
  if (row.silenced_until && Date.parse(row.silenced_until) > now) return false;
  const status = row.status ?? "open";
  return status === "open" || status === "reopened";
}

export function deriveAlertStatus(row: {
  status?: string | null;
  resolved_at?: string | null;
  acknowledged_at?: string | null;
  silenced_until?: string | null;
}): string {
  if (row.status) return row.status;
  if (row.resolved_at) return "resolved";
  if (row.silenced_until && Date.parse(row.silenced_until) > Date.now()) return "silenced";
  if (row.acknowledged_at) return "acknowledged";
  return "open";
}

export const TRIGGER_LABELS: Record<string, string> = {
  "order.created": "Pedido creado",
  "order.confirmed": "Pedido confirmado",
  "shipment.status_changed": "Estado de envío cambiado",
  "shipment.rto": "Envío RTO",
  "campaign.rto_threshold_exceeded": "RTO de campaña excedido",
  "settlement.discrepancy": "Discrepancia de conciliación",
  "integration.health_degraded": "Integración degradada",
};

export function labelTrigger(t: string) {
  return TRIGGER_LABELS[t] ?? t;
}
