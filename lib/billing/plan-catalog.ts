/**
 * Merchant-facing copy for plans (pure — server and client): what each locked
 * section does, and the rows of the plan comparison in Facturación.
 * What a plan unlocks comes from `plans.features` via entitlements.ts.
 */

import { PLAN_SECTION_MIN_PLAN, type PlanSection } from "@/lib/billing/entitlements";

export type PlanSectionCopy = {
  title: string;
  benefit: string;
};

export const PLAN_SECTION_COPY: Record<PlanSection, PlanSectionCopy> = {
  console: {
    title: "Elige un plan para empezar",
    benefit:
      "Con Starter ves tus pedidos COD, el ROAS real y el RTO, y envías con Flipy y tus couriers.",
  },
  reconciliation: {
    title: "Conciliación de cobros",
    benefit: "Cruza el efectivo que reporta cada courier con tus pedidos y detecta diferencias.",
  },
  whatsapp: {
    title: "Confirmación por WhatsApp",
    benefit: "Confirma cada pedido contra entrega antes de enviarlo y reduce las devoluciones.",
  },
  automations: {
    title: "Automatizaciones",
    benefit: "Reacciona solo a cambios de pedido, envío o cobro con reglas propias.",
  },
  conversions: {
    title: "Conversiones a Meta y TikTok",
    benefit:
      "Envía a tus campañas los pedidos entregados y cobrados para que optimicen por ventas reales.",
  },
  api: {
    title: "Claves API",
    benefit: "Conecta tus sistemas con los datos de CODTracked.",
  },
};

/** "Disponible en Growth" — short label for badges and nav pills. */
export function planSectionBadge(section: PlanSection): string {
  return PLAN_SECTION_MIN_PLAN[section];
}

/** Self-serve tiers shown in the comparison, cheapest first. */
export const SELF_SERVE_PLAN_ORDER = ["starter", "growth", "scale"] as const;

type ComparisonValue = (plan: {
  store_limit: number | null;
  order_limit: number | null;
  features: Record<string, unknown>;
}) => string | boolean;

export type PlanComparisonRow = {
  label: string;
  value: ComparisonValue;
};

function hasFeature(key: string): ComparisonValue {
  return (plan) => plan.features[key] === true;
}

function formatLimit(value: number | null): string {
  return value == null ? "Ilimitadas" : value.toLocaleString("es");
}

/** Comparison rows; limits and features come from the plan rows in the DB. */
export const PLAN_COMPARISON_ROWS: PlanComparisonRow[] = [
  { label: "Tiendas", value: (plan) => formatLimit(plan.store_limit) },
  { label: "Pedidos al mes", value: (plan) => formatLimit(plan.order_limit) },
  { label: "Pedidos COD en el Admin de Shopify", value: () => true },
  { label: "Resumen con ROAS real y RTO", value: () => true },
  { label: "Flipy y couriers (Envia, Enviame)", value: () => true },
  { label: "Atribución y campañas de Meta y TikTok", value: () => true },
  { label: "RTO por producto, zona y campaña · alertas", value: () => true },
  { label: "Conciliación de cobros", value: hasFeature("reconciliation") },
  { label: "Confirmación COD por WhatsApp", value: hasFeature("whatsapp") },
  { label: "Automatizaciones", value: hasFeature("automations") },
  { label: "Conversiones a Meta y TikTok", value: hasFeature("conversions") },
  { label: "Claves API", value: hasFeature("api") },
  { label: "Marca blanca", value: hasFeature("white_label") },
];

const FEATURE_HIGHLIGHTS: Array<[key: string, label: string]> = [
  ["reconciliation", "Conciliación de cobros"],
  ["whatsapp", "Confirmación por WhatsApp"],
  ["automations", "Automatizaciones"],
  ["conversions", "Conversiones a Meta y TikTok"],
  ["api", "Claves API"],
  ["white_label", "Marca blanca"],
];

const STARTER_HIGHLIGHTS = [
  "Pedidos COD, ROAS real y RTO",
  "Flipy y couriers integrados",
  "Atribución de Meta y TikTok",
];

function asFeatures(raw: unknown): Record<string, unknown> {
  return raw && typeof raw === "object" && !Array.isArray(raw)
    ? (raw as Record<string, unknown>)
    : {};
}

/**
 * Card bullets: Starter lists the console basics; each higher tier lists
 * "Todo lo de <anterior>" plus the features it adds over the previous tier.
 */
export function planCardHighlights(
  plan: { code: string; features: unknown },
  previous: { name: string; features: unknown } | null,
): string[] {
  if (!previous) return STARTER_HIGHLIGHTS;
  const features = asFeatures(plan.features);
  const before = asFeatures(previous.features);
  const added = FEATURE_HIGHLIGHTS.filter(
    ([key]) => features[key] === true && before[key] !== true,
  ).map(([, label]) => label);
  return [`Todo lo de ${previous.name}`, ...added];
}

export function comparisonFeatures(raw: unknown): Record<string, unknown> {
  return asFeatures(raw);
}
