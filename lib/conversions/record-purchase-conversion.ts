import "server-only";

import { purchaseConversionEventId } from "@/lib/conversions/purchase-event-id";
import {
  resolveMetaCapiCredentials,
  sendMetaCapiPurchase,
} from "@/lib/conversions/meta-capi";
import { logger } from "@/lib/observability/logger";
import type { DatabaseClient } from "@/services/_shared";
import type { Database, Json } from "@/types/database.generated";

type AdPlatform = Database["public"]["Enums"]["ad_platform"];

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
    .in("provider", ["meta", "tiktok"])
    .in("status", ["connected", "pending", "degraded", "error"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (anyAds.data) return anyAds.data;

  // Optional FK only — CAPI creds can come from Vercel env without a meta row.
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
  if (shopify.data) return shopify.data;

  const any = await admin
    .from("integrations")
    .select("id, provider, status, settings, metadata")
    .eq("agency_id", agencyId)
    .eq("store_id", storeId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return any.data ?? null;
}

/**
 * Ensure a Purchase conversion_events row exists (deduped by event_id) and
 * attempt Meta CAPI (integration settings → Vercel env). Missing secrets → status failed.
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
      capiMode: "live",
    };
  }

  const integration = await resolveAdsIntegration(input.admin, input.agencyId, input.storeId);
  // Purchase CAPI is Meta-only for S10. Prefer meta integration settings; else Vercel env.
  // FK may still point at shopify/tiktok when no meta row exists.
  const metaSettings = integration?.provider === "meta" ? integration.settings : null;
  const metaMetadata = integration?.provider === "meta" ? integration.metadata : null;
  const creds = resolveMetaCapiCredentials(metaSettings, metaMetadata);
  const platform: AdPlatform =
    integration?.provider === "tiktok" && !creds ? "tiktok" : "meta";

  if (!creds) {
    logger.warn("conversion.purchase.missing_capi_credentials", {
      store_id: input.storeId,
      order_id: input.orderId,
      event_id: eventId,
      has_integration: Boolean(integration),
      integration_provider: integration?.provider ?? null,
    });
  }

  const capi = await sendMetaCapiPurchase(creds, {
    eventId,
    eventTimeUnix,
    value: input.value,
    currency: input.currencyCode.slice(0, 3).toUpperCase(),
    orderId: input.orderId,
    email: input.email,
    phone: input.phone,
  });

  const status = capi.ok ? "sent" : "failed";
  const customData = {
    dry_run: false,
    source: "cash_collected",
    order_id: input.orderId,
    no_integration: !integration,
    credentials_source: capi.credentialsSource ?? null,
    missing_credentials: !creds,
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
      credentials_source: capi.credentialsSource ?? null,
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
      integration_id: integration?.id ?? null,
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
    credentials_source: capi.credentialsSource ?? null,
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
