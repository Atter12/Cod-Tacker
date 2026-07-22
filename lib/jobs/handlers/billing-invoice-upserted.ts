import { z } from "zod";
import { PermanentJobError } from "@/lib/jobs/errors";
import type { JobHandler, JobHandlerResult } from "@/lib/jobs/types";
import type { Json } from "@/types/database.generated";

export const billingInvoiceUpsertedPayloadSchema = z.object({
  agencyId: z.string().uuid(),
  providerInvoiceId: z.string().min(1).max(200),
  invoiceNumber: z.string().min(1).max(200),
  status: z.enum(["draft", "open", "paid", "void", "uncollectible"]),
  currencyCode: z.string().min(3).max(3),
  amountCents: z.number().int().nonnegative(),
  periodStart: z.string().nullable(),
  periodEnd: z.string().nullable(),
  issuedAt: z.string().min(1),
  paidAt: z.string().nullable(),
  providerSubscriptionId: z.string().min(1).max(200).nullable(),
  hostedInvoiceUrl: z.string().nullable(),
  invoicePdf: z.string().nullable(),
  source_event: z.string().optional(),
  stripe_event_id: z.string().optional(),
  mark_past_due: z.boolean().optional(),
});

function asObject(payload: Json): Record<string, unknown> {
  if (payload && typeof payload === "object" && !Array.isArray(payload)) {
    return payload as Record<string, unknown>;
  }
  throw new PermanentJobError(
    "INVALID_PAYLOAD",
    "El payload de billing.invoice.upserted no es un objeto válido.",
  );
}

export const handleBillingInvoiceUpserted: JobHandler = async ({
  admin,
  job,
  payload,
}): Promise<JobHandlerResult> => {
  const parsed = billingInvoiceUpsertedPayloadSchema.safeParse(asObject(payload));
  if (!parsed.success) {
    throw new PermanentJobError(
      "INVALID_PAYLOAD",
      "Payload de billing.invoice.upserted inválido.",
    );
  }

  const data = parsed.data;
  if (job.agency_id !== data.agencyId) {
    throw new PermanentJobError(
      "AGENCY_MISMATCH",
      "agency_id del job no coincide con el payload de invoice.",
    );
  }

  const { data: sub } = await admin
    .from("subscriptions")
    .select("id")
    .eq("agency_id", data.agencyId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const metadata = {
    provider: "stripe",
    provider_invoice_id: data.providerInvoiceId,
    hosted_invoice_url: data.hostedInvoiceUrl,
    invoice_pdf: data.invoicePdf,
    provider_subscription_id: data.providerSubscriptionId,
    stripe_event_id: data.stripe_event_id ?? null,
    source_event: data.source_event ?? null,
  } as Json;

  const { data: existingByProvider } = await admin
    .from("invoice_records")
    .select("id")
    .eq("agency_id", data.agencyId)
    .contains("metadata", { provider_invoice_id: data.providerInvoiceId })
    .maybeSingle();

  const { data: existingByNumber } = existingByProvider
    ? { data: null }
    : await admin
        .from("invoice_records")
        .select("id")
        .eq("agency_id", data.agencyId)
        .eq("invoice_number", data.invoiceNumber)
        .maybeSingle();

  const existing = existingByProvider ?? existingByNumber;

  if (existing) {
    const { error } = await admin
      .from("invoice_records")
      .update({
        status: data.status,
        currency_code: data.currencyCode,
        amount_cents: data.amountCents,
        period_start: data.periodStart,
        period_end: data.periodEnd,
        issued_at: data.issuedAt,
        paid_at: data.paidAt,
        subscription_id: sub?.id ?? null,
        metadata,
      })
      .eq("id", existing.id);
    if (error) throw error;
  } else {
    const { error } = await admin.from("invoice_records").insert({
      agency_id: data.agencyId,
      subscription_id: sub?.id ?? null,
      invoice_number: data.invoiceNumber,
      status: data.status,
      currency_code: data.currencyCode,
      amount_cents: data.amountCents,
      period_start: data.periodStart,
      period_end: data.periodEnd,
      issued_at: data.issuedAt,
      paid_at: data.paidAt,
      metadata,
    });
    if (error) throw error;
  }

  if (data.mark_past_due && sub) {
    const { data: subRow } = await admin
      .from("subscriptions")
      .select("id, metadata")
      .eq("id", sub.id)
      .maybeSingle();
    const prevMeta =
      subRow?.metadata &&
      typeof subRow.metadata === "object" &&
      !Array.isArray(subRow.metadata)
        ? (subRow.metadata as Record<string, unknown>)
        : {};
    const pastDueSince =
      typeof prevMeta.past_due_since === "string" && prevMeta.past_due_since
        ? prevMeta.past_due_since
        : new Date().toISOString();

    await admin
      .from("subscriptions")
      .update({
        status: "past_due",
        billing_provider: "stripe",
        metadata: {
          ...prevMeta,
          past_due_since: pastDueSince,
          stripe_event_id: data.stripe_event_id ?? null,
          source_event: data.source_event ?? null,
        } as Json,
        updated_at: new Date().toISOString(),
      })
      .eq("id", sub.id);
  } else if (data.status === "paid" && sub) {
    // Successful payment — clear past_due marker; subscription.updated usually
    // restores status, but this covers invoice.paid arriving first.
    const { data: subRow } = await admin
      .from("subscriptions")
      .select("id, status, metadata")
      .eq("id", sub.id)
      .maybeSingle();
    if (subRow?.status === "past_due") {
      const prevMeta =
        subRow.metadata &&
        typeof subRow.metadata === "object" &&
        !Array.isArray(subRow.metadata)
          ? (subRow.metadata as Record<string, unknown>)
          : {};
      const { past_due_since: _drop, ...rest } = prevMeta;
      void _drop;
      await admin
        .from("subscriptions")
        .update({
          status: "active",
          billing_provider: "stripe",
          metadata: rest as Json,
          updated_at: new Date().toISOString(),
        })
        .eq("id", sub.id);
    }
  }

  return {
    ok: true,
    action: existing ? "updated" : "created",
    entityType: "invoice_record",
    entityId: existing?.id,
  };
};
