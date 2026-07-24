export type DomainInvoiceStatus = "draft" | "open" | "paid" | "void" | "uncollectible";

export function mapStripeInvoiceStatus(
  stripeStatus: string | null | undefined,
): DomainInvoiceStatus {
  switch (stripeStatus) {
    case "draft":
      return "draft";
    case "open":
      return "open";
    case "paid":
      return "paid";
    case "void":
      return "void";
    case "uncollectible":
      return "uncollectible";
    default:
      return "open";
  }
}

export type NormalizedBillingInvoice = {
  agencyId: string;
  providerInvoiceId: string;
  invoiceNumber: string;
  status: DomainInvoiceStatus;
  currencyCode: string;
  amountCents: number;
  periodStart: string | null;
  periodEnd: string | null;
  issuedAt: string;
  paidAt: string | null;
  providerSubscriptionId: string | null;
  hostedInvoiceUrl: string | null;
  invoicePdf: string | null;
};

export function unixToIso(seconds: number | null | undefined): string | null {
  if (seconds == null || !Number.isFinite(seconds)) return null;
  return new Date(seconds * 1000).toISOString();
}
