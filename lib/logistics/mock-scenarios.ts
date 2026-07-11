import type { ShipmentStatus } from "@/lib/logistics/normalize";

export type MockCarrierScenarioStep = {
  externalStatusCode: string;
  externalStatusLabel: string;
  /** Hours after scenario start */
  offsetHours: number;
};

export type MockCarrierScenario = {
  id: string;
  label: string;
  steps: MockCarrierScenarioStep[];
};

/** Deterministic happy-path → delivered */
export const SCENARIO_DELIVERED: MockCarrierScenario = {
  id: "delivered",
  label: "Entrega exitosa",
  steps: [
    { externalStatusCode: "CREADO", externalStatusLabel: "Creado", offsetHours: 0 },
    { externalStatusCode: "RECOGIDO", externalStatusLabel: "Recogido", offsetHours: 4 },
    { externalStatusCode: "TRANSITO", externalStatusLabel: "En tránsito", offsetHours: 12 },
    { externalStatusCode: "REPARTO", externalStatusLabel: "En reparto", offsetHours: 28 },
    { externalStatusCode: "ENTREGADO", externalStatusLabel: "Entregado", offsetHours: 30 },
  ],
};

/** Failed attempt then RTO */
export const SCENARIO_RTO: MockCarrierScenario = {
  id: "rto",
  label: "Intento fallido → RTO",
  steps: [
    { externalStatusCode: "TRANSITO", externalStatusLabel: "En tránsito", offsetHours: 0 },
    { externalStatusCode: "REPARTO", externalStatusLabel: "En reparto", offsetHours: 8 },
    { externalStatusCode: "FALLIDO", externalStatusLabel: "No entregado", offsetHours: 10 },
    { externalStatusCode: "DEV_TRANSITO", externalStatusLabel: "Devolución en tránsito", offsetHours: 24 },
    { externalStatusCode: "DEVUELTO", externalStatusLabel: "Devuelto", offsetHours: 48 },
  ],
};

/** Out-of-order terminal regression fixture (delivered then older in_transit) */
export const SCENARIO_OUT_OF_ORDER: MockCarrierScenario = {
  id: "out_of_order",
  label: "Fuera de orden (terminal)",
  steps: [
    { externalStatusCode: "ENTREGADO", externalStatusLabel: "Entregado", offsetHours: 20 },
    { externalStatusCode: "TRANSITO", externalStatusLabel: "En tránsito (atrasado)", offsetHours: 5 },
  ],
};

export const MOCK_CARRIER_SCENARIOS: MockCarrierScenario[] = [
  SCENARIO_DELIVERED,
  SCENARIO_RTO,
  SCENARIO_OUT_OF_ORDER,
];

/** Default mock carrier mappings used by seed / normalize tests / admin test normalize. */
export const DEFAULT_MOCK_CARRIER_MAPPINGS: Array<{
  external_status_code: string;
  external_status_label: string;
  normalized_status: ShipmentStatus;
  is_rto: boolean;
  is_terminal: boolean;
  priority: number;
}> = [
  { external_status_code: "CREADO", external_status_label: "Creado", normalized_status: "created", is_rto: false, is_terminal: false, priority: 0 },
  { external_status_code: "RECOGIDO", external_status_label: "Recogido", normalized_status: "picked_up", is_rto: false, is_terminal: false, priority: 0 },
  { external_status_code: "TRANSITO", external_status_label: "En tránsito", normalized_status: "in_transit", is_rto: false, is_terminal: false, priority: 0 },
  { external_status_code: "REPARTO", external_status_label: "En reparto", normalized_status: "out_for_delivery", is_rto: false, is_terminal: false, priority: 0 },
  { external_status_code: "ENTREGADO", external_status_label: "Entregado", normalized_status: "delivered", is_rto: false, is_terminal: true, priority: 10 },
  { external_status_code: "FALLIDO", external_status_label: "No entregado", normalized_status: "delivery_failed", is_rto: false, is_terminal: false, priority: 0 },
  { external_status_code: "DEV_TRANSITO", external_status_label: "Devolución en tránsito", normalized_status: "return_in_transit", is_rto: true, is_terminal: false, priority: 0 },
  { external_status_code: "DEVUELTO", external_status_label: "Devuelto", normalized_status: "returned", is_rto: true, is_terminal: true, priority: 10 },
];

export function getScenario(id: string): MockCarrierScenario | undefined {
  return MOCK_CARRIER_SCENARIOS.find((s) => s.id === id);
}

export function nextScenarioStep(
  scenario: MockCarrierScenario,
  currentIndex: number,
): { step: MockCarrierScenarioStep; nextIndex: number } | null {
  if (currentIndex < 0 || currentIndex >= scenario.steps.length) return null;
  return { step: scenario.steps[currentIndex]!, nextIndex: currentIndex + 1 };
}

export function occurredAtForStep(baseIso: string, step: MockCarrierScenarioStep): string {
  const base = Date.parse(baseIso);
  return new Date(base + step.offsetHours * 3_600_000).toISOString();
}
