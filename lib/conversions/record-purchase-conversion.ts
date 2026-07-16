import "server-only";

import { purchaseConversionEventId } from "@/lib/conversions/purchase-event-id";
import {
  readMetaCapiCredentials,
  sendMetaCapiPurchase,
} from "@/lib/conversions/meta-capi";
import { logger } from "@/lib/observability/logger";
import type { DatabaseClient } from "@/services/_shared";
import type { Json } from "@/types/database.generated";

export type RecordPurchaseConversionInput = {
  admin: DatabaseClient;
  agencyId: string;
  storeId: string;
  orderId: string;
  value: number;
  currencyCode: string;
  eventTime?: string;
  email?: string | null;
  phone?: string | null;
};

export type RecordPurchaseConversionResult = {
  created: boolean;
  eventId: string;
  conversionEventRowId: string | null;
  deliveryStatus: string;
  capiMode: "live" | "dry_run";
};

async function resolveAdsIntegration(
  admin: DatabaseClient,
  agencyId: string,
  storeId: string,
): Promise<{
  id: string;
  provider: string;
  settings: unknown;
  metadata: unknown;
} | null> {
  const meta = await admin
    .from("integrations")
    .select("id, provider, status, settings, metadata")
    .eq("agency_id", agencyId)
    .eq("store_id", storeId)
    .eq("provider", "meta")
    .in("status", ["connected", "pending", "degraded", "error"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (meta.data) return meta.data;

  const anyAds = await admin
    .from("integrations")
    .select("id, provider, status, settings, metadata")
    .eq("agency_id", agencyId)
    .eq("store_id", storeId)
    .in("provider", ["meta", "tiktok", "google"])
    .in("status", ["connected", "pending", "degraded", "error"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (anyAds.data) return anyAds.data;

  // Fallback so the DB row can exist for dry-run even before Meta is connected.
  const shopify = await admin
    .from("integrations")
    .select("id, provider, status, settings, metadata")
    .eq("agency_id", agencyId)
    .eq("store_id", storeId)
    .eq("provider", "shopify")
    .in("status", ["connected", "pending", "degraded", "error"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return shopify.data ?? null;
}

/**
 * Ensure a Purchase conversion_events row exists (deduped by event_id) and
 * attempt Meta CAPI when credentials are configured; otherwise dry-run log.
 */
export async function recordPurchaseConversionEvent(
  input: RecordPurchaseConversionInput,
): Promise<RecordPurchaseConversionResult> {
  const eventId = purchaseConversionEventId(input.orderId);
  const eventTime = input.eventTime ?? new Date().toISOString();
  const eventTimeUnix = Math.floor(new Date(eventTime).getTime() / 1000);

  const existing = await input.admin
    .from("conversion_events")
    .select("id, status, sent_at")
    .eq("store_id", input.storeId)
    .eq("event_id", eventId)
    .maybeSingle();

  if (existing.data?.id && existing.data.sent_at) {
    return {
      created: false,
      eventId,
      conversionEventRowId: existing.data.id,
      deliveryStatus: existing.data.status,
      capiMode: "dry_run",
    };
  }

  const integration = await resolveAdsIntegration(input.admin, input.agencyId, input.storeId);
  if (!integration) {
    logger.warn("conversion.purchase.no_integration", {
      store_id: input.storeId,
      order_id: input.orderId,
      event_id: eventId,
    });
    return {
      created: false,
      eventId,
      conversionEventRowId: null,
      deliveryStatus: "failed",
      capiMode: "dry_run",
    };
  }

  const platform =
    integration.provider === "meta" ||
    integration.provider === "tiktok" ||
    integration.provider === "google"
      ? integration.provider
      : "meta";

  const creds =
    platform === "meta"
      ? readMetaCapiCredentials(integration.settings, integration.metadata)
      : null;

  const capi = await sendMetaCapiPurchase(creds, {
    eventId,
    eventTimeUnix,
    value: input.value,
    currency: input.currencyCode.slice(0, 3).toUpperCase(),
    orderId: input.orderId,
    email: input.email,
    phone: input.phone,
  });

  const status = capi.mode === "dry_run" ? "queued" : capi.ok ? "sent" : "failed";
  const customData = {
    dry_run: capi.mode === "dry_run",
    source: "cash_collected",
    order_id: input.orderId,
  } as Json;
  const responsePayload = (capi.body ?? {
    mode: capi.mode,
    ok: capi.ok,
    error: capi.error ?? null,
  }) as Json;

  if (existing.data?.id) {
    await input.admin
      .from("conversion_events")
      .update({
        status,
        attempts: 1,
        sent_at: status === "sent" ? new Date().toISOString() : null,
        last_error_message: capi.error ?? null,
        response_payload: responsePayload,
        custom_data: customData,
        value: input.value,
        currency_code: input.currencyCode.slice(0, 3).toUpperCase(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", existing.data.id)
      .eq("store_id", input.storeId);

    logger.info("conversion.purchase.updated", {
      event_id: eventId,
      order_id: input.orderId,
      status,
      capi_mode: capi.mode,
    });

    return {
      created: false,
      eventId,
      conversionEventRowId: existing.data.id,
      deliveryStatus: status,
      capiMode: capi.mode,
    };
  }

  const inserted = await input.admin
    .from("conversion_events")
    .insert({
      agency_id: input.agencyId,
      store_id: input.storeId,
      order_id: input.orderId,
      integration_id: integration.id,
      platform,
      event_id: eventId,
      event_name: "Purchase",
      event_time: eventTime,
      status,
      attempts: 1,
      value: input.value,
      currency_code: input.currencyCode.slice(0, 3).toUpperCase(),
      user_data: {
        email_present: Boolean(input.email?.trim()),
        phone_present: Boolean(input.phone?.trim()),
      } as Json,
      custom_data: customData,
      response_payload: responsePayload,
      sent_at: status === "sent" ? new Date().toISOString() : null,
      last_error_message: capi.error ?? null,
    })
    .select("id")
    .maybeSingle();

  if (inserted.error) {
    // Race: another worker inserted the same event_id.
    const again = await input.admin
      .from("conversion_events")
      .select("id, status")
      .eq("store_id", input.storeId)
      .eq("event_id", eventId)
      .maybeSingle();
    if (again.data) {
      return {
        created: false,
        eventId,
        conversionEventRowId: again.data.id,
        deliveryStatus: again.data.status,
        capiMode: capi.mode,
      };
    }
    logger.error("conversion.purchase.insert_failed", {
      event_id: eventId,
      order_id: input.orderId,
      error: inserted.error.message,
    });
    return {
      created: false,
      eventId,
      conversionEventRowId: null,
      deliveryStatus: "failed",
      capiMode: capi.mode,
    };
  }

  logger.info("conversion.purchase.recorded", {
    event_id: eventId,
    order_id: input.orderId,
    status,
    capi_mode: capi.mode,
    conversion_event_id: inserted.data?.id ?? null,
  });

  return {
    created: true,
    eventId,
    conversionEventRowId: inserted.data?.id ?? null,
    deliveryStatus: status,
    capiMode: capi.mode,
  };
}
