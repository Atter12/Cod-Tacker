/**
 * Pure chrome for agency Facturación when the provider is Shopify vs Stripe/demo.
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
        "La consola muestra el estado sincronizado desde Shopify App Pricing. No uses Stripe Checkout para esta agencia.",
      manageLabel: "Administrar en Shopify",
      hideLocalCancelControls: true,
      planCtaOpensShopify: true,
      planCtaLabel: ({ current, selfServe }) =>
        current ? "Plan actual" : !selfServe ? "Hablar con ventas" : "Elegir en Shopify",
      comparePlansHint:
        "Límites de tiendas y pedidos en COD-tracked. El cobro self-serve se aprueba en Shopify.",
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
      comparePlansHint: "Límites de tiendas y pedidos en COD-tracked.",
      footerNote:
        "No se almacenan datos de tarjeta. Stripe Checkout / Portal gestionan el cobro. Los límites se aplican al crear tiendas e importar CSV.",
      invoicesEmpty: "Sin facturas aún.",
      hideStripeInvoiceExpectation: false,
    };
  }

  return {
    providerLabel: "Facturación de demostración",
    banner: "",
    platformNote:
      "Modo demo: cambios de plan locales sin cargo real. En producción usa Stripe (legado) o Shopify App Pricing.",
    manageLabel: "Portal de facturación",
    hideLocalCancelControls: false,
    planCtaOpensShopify: false,
    planCtaLabel: ({ current, selfServe }) =>
      current ? "Plan actual" : !selfServe ? "Hablar con ventas" : "Seleccionar",
    comparePlansHint: "Límites de tiendas y pedidos en COD-tracked (demo).",
    footerNote: "No se almacenan datos de tarjeta. Modo demo aplica el plan al instante.",
    invoicesEmpty: "Sin facturas aún.",
    hideStripeInvoiceExpectation: false,
  };
}
