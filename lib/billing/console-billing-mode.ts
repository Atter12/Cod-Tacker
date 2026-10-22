/**
 * Pure chrome for agency Facturación (Shopify App Pricing or demo; the Stripe branch is retired).
 */

export type ConsoleBillingMode = "demo" | "stripe" | "shopify";

export type ConsoleBillingChrome = {
  providerLabel: string;
  banner: string;
  platformNote: string;
  manageLabel: string;
  /** Hide Stripe Customer Portal cancel/reactivate controls. */
  hideLocalCancelControls: boolean;
  /** Plan cards open Shopify instead of applying locally / Stripe Checkout. */
  planCtaOpensShopify: boolean;
  planCtaLabel: (input: { current: boolean; selfServe: boolean }) => string;
  comparePlansHint: string;
  footerNote: string;
  invoicesEmpty: string;
  hideStripeInvoiceExpectation: boolean;
};

export function resolveConsoleBillingChrome(mode: ConsoleBillingMode): ConsoleBillingChrome {
  if (mode === "shopify") {
    return {
      providerLabel: "Shopify App Pricing",
      banner:
        "Este plan se cobra en la factura de Shopify del merchant. Cambios de plan, cancelación y método de pago se administran en el Admin de Shopify.",
      platformNote:
        "El estado del plan se sincroniza desde Shopify. Para cambiarlo o cancelarlo, usa Administrar en Shopify.",
      manageLabel: "Administrar en Shopify",
      hideLocalCancelControls: true,
      planCtaOpensShopify: true,
      planCtaLabel: ({ current, selfServe }) =>
        current ? "Plan actual" : !selfServe ? "Hablar con ventas" : "Elegir en Shopify",
      comparePlansHint:
        "Qué incluye cada plan. El cambio de plan se aprueba en Shopify y se cobra en tu factura.",
      footerNote:
        "No se almacenan tarjetas en COD-tracked. Shopify factura al merchant y sincronizamos el estado del plan.",
      invoicesEmpty:
        "Sin facturas locales. El historial de cargos de la app está en el Admin de Shopify (Facturación → Apps).",
      hideStripeInvoiceExpectation: true,
    };
  }

  if (mode === "stripe") {
    return {
      providerLabel: "Stripe",
      banner: "",
      platformNote:
        "Plan SaaS de la agencia cobrado con Stripe. Si esta agencia migrara a App Pricing, el proveedor pasaría a Shopify.",
      manageLabel: "Portal de facturación",
      hideLocalCancelControls: false,
      planCtaOpensShopify: false,
      planCtaLabel: ({ current, selfServe }) =>
        current ? "Plan actual" : !selfServe ? "Hablar con ventas" : "Comenzar ahora",
      comparePlansHint: "Qué incluye cada plan. Puedes cambiar de plan cuando quieras.",
      footerNote:
        "No se almacenan datos de tarjeta. Stripe Checkout / Portal gestionan el cobro.",
      invoicesEmpty: "Sin facturas aún.",
      hideStripeInvoiceExpectation: false,
    };
  }

  return {
    providerLabel: "Facturación de demostración",
    banner: "",
    platformNote:
      "Modo demo: cambios de plan locales sin cargo real. En producción el plan se cobra con Shopify App Pricing.",
    manageLabel: "Portal de facturación",
    hideLocalCancelControls: false,
    planCtaOpensShopify: false,
    planCtaLabel: ({ current, selfServe }) =>
      current ? "Plan actual" : !selfServe ? "Hablar con ventas" : "Seleccionar",
    comparePlansHint: "Qué incluye cada plan (demo: el cambio se aplica sin cargo).",
    footerNote: "No se almacenan datos de tarjeta. Modo demo aplica el plan al instante.",
    invoicesEmpty: "Sin facturas aún.",
    hideStripeInvoiceExpectation: false,
  };
}
