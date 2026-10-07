/**
 * Pure helpers for the Shopify embed plan CTA (App Pricing).
 * Soft gate: connector/orders stay visible; CTA sends merchants to Shopify's hosted plans.
 */

export type EmbedPlanStatus =
  | "none"
  | "trialing"
  | "active"
  | "past_due"
  | "cancelled"
  | "expired"
  | "paused";

export type EmbedPlanStateInput = {
  subscriptionStatus: string | null | undefined;
  planName: string | null | undefined;
  planCode: string | null | undefined;
  pricingPlansUrl: string | null | undefined;
};

export type EmbedPlanState = {
  status: EmbedPlanStatus;
  planName: string | null;
  planCode: string | null;
  pricingPlansUrl: string | null;
  /** Primary CTA when the merchant still needs to pick/approve a plan. */
  showPlanCta: boolean;
  planCtaLabel: string;
  /** Secondary control when a Shopify plan is already active. */
  showManagePlan: boolean;
  managePlanLabel: string;
  statusLabel: string;
  billingNote: string;
};

function normalizeStatus(raw: string | null | undefined): EmbedPlanStatus {
  switch ((raw ?? "").trim().toLowerCase()) {
    case "trialing":
      return "trialing";
    case "active":
      return "active";
    case "past_due":
      return "past_due";
    case "cancelled":
      return "cancelled";
    case "expired":
      return "expired";
    case "paused":
      return "paused";
    default:
      return "none";
  }
}

export function resolveEmbedPlanState(input: EmbedPlanStateInput): EmbedPlanState {
  const status = normalizeStatus(input.subscriptionStatus);
  const pricingPlansUrl = input.pricingPlansUrl?.trim() || null;
  const planName = input.planName?.trim() || null;
  const planCode = input.planCode?.trim() || null;
  const hasPaidLike = status === "active" || status === "trialing";
  const canOpenPlans = Boolean(pricingPlansUrl);

  const statusLabel =
    status === "trialing"
      ? planName
        ? `Prueba · ${planName}`
        : "Prueba activa"
      : status === "active"
        ? planName
          ? `Plan ${planName}`
          : "Plan activo"
        : status === "past_due"
          ? "Pago pendiente"
          : status === "cancelled" || status === "expired"
            ? "Sin plan activo"
            : status === "paused"
              ? "Plan pausado"
              : "Sin plan";

  return {
    status,
    planName,
    planCode,
    pricingPlansUrl,
    showPlanCta: canOpenPlans && !hasPaidLike,
    planCtaLabel:
      status === "past_due"
        ? "Actualizar plan en Shopify"
        : status === "cancelled" || status === "expired" || status === "paused"
          ? "Reactivar plan"
          : "Elegir plan",
    showManagePlan: canOpenPlans && hasPaidLike,
    managePlanLabel: "Administrar plan",
    statusLabel,
    billingNote: canOpenPlans
      ? "Los planes de plataforma se eligen y cobran en tu factura de Shopify. No hay checkout de tarjeta dentro de esta app."
      : "La conexión de esta tienda está incluida. Configura SHOPIFY_APP_HANDLE para ofrecer planes en Shopify.",
  };
}

/** True when the welcome redirect from App Pricing includes a plan handle. */
export function embedWelcomePlanHandle(
  search: string | URLSearchParams | null | undefined,
): string | null {
  if (!search) return null;
  const params =
    typeof search === "string"
      ? new URLSearchParams(search.startsWith("?") ? search.slice(1) : search)
      : search;
  const handle = params.get("plan_handle")?.trim() || params.get("planHandle")?.trim();
  return handle || null;
}
