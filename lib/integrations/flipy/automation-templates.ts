import type { AutomationRuleInput } from "@/lib/automations/schema";

export const FLIPY_STALE_BID_RULE_NAME = "Flipy: envío sin puja 24h";

export function buildFlipyStaleBidAutomationRule(): AutomationRuleInput {
  return {
    name: FLIPY_STALE_BID_RULE_NAME,
    description:
      "Alerta cuando un envío Flipy sigue en PENDIENTE_PUJAS tras 24 horas sin asignación.",
    triggerType: "shipment.status_changed",
    conditions: {
      logic: "and",
      conditions: [
        { field: "carrierCode", op: "eq", value: "flipy" },
        { field: "staleBidAlert", op: "eq", value: true },
      ],
    },
    actions: [
      {
        type: "create_alert",
        title: "Flipy: envío sin puja hace 24h",
        severity: "warning",
        alertType: "flipy_stale_bid",
        body: "El envío Flipy sigue pendiente de pujas. Revisa pujas en Flipy o cancela el envío.",
      },
    ],
    cooldownMinutes: 720,
    priority: 120,
    requiresManualApproval: false,
    isActive: true,
  };
}
