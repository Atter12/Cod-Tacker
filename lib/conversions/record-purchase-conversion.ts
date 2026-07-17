import "server-only";

import { purchaseConversionEventId } from "@/lib/conversions/purchase-event-id";
import {
  resolveMetaCapiCredentials,
  sendMetaCapiPurchase,
  type MetaCapiSendResult,
} from "@/lib/conversions/meta-capi";
import {
  resolveTikTokEventsCredentials,
  sendTikTokEventsPurchase,
  type TikTokEventsSendResult,
} from "@/lib/conversions/tiktok-events";
import { logger } from "@/lib/observability/logger";
import type { DatabaseClient } from "@/services/_shared";
import type { Database, Json } from "@/types/database.generated";

type AdPlatform = Database["public"]["Enums"]["ad_platform"];
type DeliveryStatus = Database["public"]["Enums"]["delivery_status"];

export type PurchaseConversionSource =
  | "cash_collected"
  | "delivered"
  | "reconciliation";

export type RecordPurchaseConversionInput = {
  admin: DatabaseClient;
  agencyId: string;
  storeId: string;
  orderId: string;
  value: number;
  currencyCode: string;
  eventTime?: string;
  /** Provenance for conversion_events.custom_data (default cash_collected). */
  source?: PurchaseConversionSource;
  email?: string | null;
  phone?: string | null;
  countryCode?: string | null;
  city?: string | null;
};

export type RecordPurchaseConversionResult = {
  created: boolean;
  eventId: string;
  conversionEventRowId: string | null;
  deliveryStatus: string;
  capiMode: "live" | "dry_run";
};

type IntegrationLite = {
  id: string;
  provider: string;
  settings: unknown;
  metadata: unknown;
};

async function resolveProviderIntegration(
  admin: DatabaseClient,
  agencyId: string,
  storeId: string,
  provider: "meta" | "tiktok",
): Promise<IntegrationLite | null> {
  const result = await admin
    .from("integrations")
    .select("id, provider, status, settings, metadata")
    .eq("agency_id", agencyId)
    .eq("store_id", storeId)
    .eq("provider", provider)
    .in("status", ["connected", "pending", "degraded", "error"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return result.data ?? null;
}

/** FK target for conversion_events — prefer ads row, else shopify/any. */
async function resolveConversionIntegrationFk(
  admin: DatabaseClient,
  agencyId: string,
  storeId: string,
  meta: IntegrationLite | null,
  tiktok: IntegrationLite | null,
): Promise<IntegrationLite | null> {
  if (meta) return meta;
  if (tiktok) return tiktok;

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

async function resolveOrderCustomerContact(
  admin: DatabaseClient,
  storeId: string,
  orderId: string,
): Promise<{
  email: string | null;
  phone: string | null;
  countryCode: string | null;
  city: string | null;
}> {
  const order = await admin
    .from("orders")
    .select("customer_id, shipping_country_code, shipping_city")
    .eq("id", orderId)
    .eq("store_id", storeId)
    .maybeSingle();

  let email: string | null = null;
  let phone: string | null = null;
  if (order.data?.customer_id) {
    const customer = await admin
      .from("customers")
      .select("email, phone")
      .eq("id", order.data.customer_id)
      .eq("store_id", storeId)
      .maybeSingle();
    email = customer.data?.email?.trim() || null;
    phone = customer.data?.phone?.trim() || null;
  }

  return {
    email,
    phone,
    countryCode: order.data?.shipping_country_code?.trim() || null,
    city: order.data?.shipping_city?.trim() || null,
  };
}

function aggregateDelivery(input: {
  meta: MetaCapiSendResult;
  tiktok: TikTokEventsSendResult;
}): {
  status: DeliveryStatus;
  capiMode: "live" | "dry_run";
  lastError: string | null;
} {
  const metaLiveOk = input.meta.mode === "live" && input.meta.ok;
  const tiktokLiveOk = input.tiktok.mode === "live" && input.tiktok.ok;
  if (metaLiveOk || tiktokLiveOk) {
    return {
      status: "sent",
      capiMode: "live",
      lastError: null,
    };
  }

  const metaHadCreds = Boolean(input.meta.credentialsSource);
  // S12: TikTok dry_run when missing creds — only if Meta did not fail a live attempt with secrets.
  if (input.tiktok.mode === "dry_run" && !metaHadCreds) {
    return {
      status: "queued",
      capiMode: "dry_run",
      lastError: input.tiktok.error ?? input.meta.error ?? null,
    };
  }

  return {
    status: "failed",
    capiMode: "live",
    lastError: input.meta.error ?? input.tiktok.error ?? null,
  };
}

/**
 * Ensure a Purchase conversion_events row exists (deduped by event_id) and
 * attempt Meta CAPI + TikTok Events API (integration settings → Vercel env).
 * TikTok missing secrets → dry_run; Meta missing secrets → failed (S10).
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

  const [metaIntegration, tiktokIntegration] = await Promise.all([
    resolveProviderIntegration(input.admin, input.agencyId, input.storeId, "meta"),
    resolveProviderIntegration(input.admin, input.agencyId, input.storeId, "tiktok"),
  ]);
  const integration = await resolveConversionIntegrationFk(
    input.admin,
    input.agencyId,
    input.storeId,
    metaIntegration,
    tiktokIntegration,
  );

  const metaCreds = resolveMetaCapiCredentials(
    metaIntegration?.settings ?? null,
    metaIntegration?.metadata ?? null,
  );
  const tiktokCreds = resolveTikTokEventsCredentials(
    tiktokIntegration?.settings ?? null,
    tiktokIntegration?.metadata ?? null,
  );

  const platform: AdPlatform = tiktokCreds && !metaCreds ? "tiktok" : "meta";

  if (!metaCreds) {
    logger.warn("conversion.purchase.missing_capi_credentials", {
      store_id: input.storeId,
      order_id: input.orderId,
      event_id: eventId,
      has_meta_integration: Boolean(metaIntegration),
    });
  }
  if (!tiktokCreds) {
    logger.info("conversion.purchase.tiktok_dry_run_credentials", {
      store_id: input.storeId,
      order_id: input.orderId,
      event_id: eventId,
      has_tiktok_integration: Boolean(tiktokIntegration),
    });
  }

  const contact =
    input.email || input.phone || input.countryCode || input.city
      ? {
          email: input.email ?? null,
          phone: input.phone ?? null,
          countryCode: input.countryCode ?? null,
          city: input.city ?? null,
        }
      : await resolveOrderCustomerContact(input.admin, input.storeId, input.orderId);

  const currency = input.currencyCode.slice(0, 3).toUpperCase();
  const sharedPayload = {
    eventId,
    value: input.value,
    currency,
    orderId: input.orderId,
    email: contact.email,
    phone: contact.phone,
  };

  const [meta, tiktok] = await Promise.all([
    sendMetaCapiPurchase(metaCreds, {
      ...sharedPayload,
      eventTimeUnix,
      countryCode: contact.countryCode,
      city: contact.city,
    }),
    sendTikTokEventsPurchase(tiktokCreds, {
      ...sharedPayload,
      eventTimeIso: eventTime,
      externalId: input.orderId,
    }),
  ]);

  const aggregated = aggregateDelivery({ meta, tiktok });
  const customData = {
    dry_run: aggregated.capiMode === "dry_run",
    source: input.source ?? "cash_collected",
    order_id: input.orderId,
    no_integration: !integration,
    meta: {
      mode: meta.mode,
      ok: meta.ok,
      credentials_source: meta.credentialsSource ?? null,
      missing_credentials: !metaCreds,
      error: meta.error ?? null,
    },
    tiktok: {
      mode: tiktok.mode,
      ok: tiktok.ok,
      credentials_source: tiktok.credentialsSource ?? null,
      missing_credentials: !tiktokCreds,
      error: tiktok.error ?? null,
    },
  } as Json;
  const responsePayload = {
    meta: meta.body ?? { mode: meta.mode, ok: meta.ok, error: meta.error ?? null },
    tiktok: tiktok.body ?? { mode: tiktok.mode, ok: tiktok.ok, error: tiktok.error ?? null },
  } as Json;

  if (existing.data?.id) {
    await input.admin
      .from("conversion_events")
      .update({
        status: aggregated.status,
        attempts: 1,
        sent_at: aggregated.status === "sent" ? new Date().toISOString() : null,
        last_error_message: aggregated.lastError,
        response_payload: responsePayload,
        custom_data: customData,
        value: input.value,
        currency_code: currency,
        platform,
        updated_at: new Date().toISOString(),
      })
      .eq("id", existing.data.id)
      .eq("store_id", input.storeId);

    logger.info("conversion.purchase.updated", {
      event_id: eventId,
      order_id: input.orderId,
      status: aggregated.status,
      capi_mode: aggregated.capiMode,
      meta_mode: meta.mode,
      tiktok_mode: tiktok.mode,
    });

    return {
      created: false,
      eventId,
      conversionEventRowId: existing.data.id,
      deliveryStatus: aggregated.status,
      capiMode: aggregated.capiMode,
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
      status: aggregated.status,
      attempts: 1,
      value: input.value,
      currency_code: currency,
      user_data: {
        email_present: Boolean(contact.email?.trim()),
        phone_present: Boolean(contact.phone?.trim()),
        country_present: Boolean(contact.countryCode?.trim()),
        city_present: Boolean(contact.city?.trim()),
        external_id_hashed: true,
      } as Json,
      custom_data: customData,
      response_payload: responsePayload,
      sent_at: aggregated.status === "sent" ? new Date().toISOString() : null,
      last_error_message: aggregated.lastError,
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
        capiMode: aggregated.capiMode,
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
      capiMode: aggregated.capiMode,
    };
  }

  logger.info("conversion.purchase.recorded", {
    event_id: eventId,
    order_id: input.orderId,
    status: aggregated.status,
    capi_mode: aggregated.capiMode,
    meta_mode: meta.mode,
    tiktok_mode: tiktok.mode,
    conversion_event_id: inserted.data?.id ?? null,
  });

  return {
    created: true,
    eventId,
    conversionEventRowId: inserted.data?.id ?? null,
    deliveryStatus: aggregated.status,
    capiMode: aggregated.capiMode,
  };
}
