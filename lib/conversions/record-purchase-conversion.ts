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
import {
  evaluatePurchaseRelease,
  type ConversionReleaseStatus,
} from "@/lib/conversions/release-policy";
import {
  mergePurchaseContact,
  purchaseContactFlags,
  resolveOrderCustomerContact,
} from "@/lib/conversions/resolve-order-contact";
import { computeRetryAt } from "@/lib/jobs/backoff";
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
  releaseStatus: ConversionReleaseStatus | null;
  holdReason: string | null;
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

function readCustomDataSource(customData: Json | null | undefined): string {
  if (customData && typeof customData === "object" && !Array.isArray(customData)) {
    const raw = (customData as Record<string, unknown>).source;
    if (typeof raw === "string" && raw.trim()) return raw;
  }
  return "cash_collected";
}

/**
 * Send an already-released Purchase candidate to Meta CAPI + TikTok Events API
 * and persist the delivery outcome on its conversion_events row.
 *
 * Guards: row must exist, be `release_status = released` and not sent yet.
 * Used by the auto-release path and by manual release / resend actions.
 */
export async function sendQueuedPurchaseConversion(input: {
  admin: DatabaseClient;
  agencyId: string;
  storeId: string;
  conversionEventRowId: string;
}): Promise<RecordPurchaseConversionResult> {
  const row = await input.admin
    .from("conversion_events")
    .select(
      "id, event_id, order_id, value, currency_code, event_time, status, attempts, max_attempts, sent_at, release_status, custom_data",
    )
    .eq("id", input.conversionEventRowId)
    .eq("store_id", input.storeId)
    .maybeSingle();

  if (!row.data) {
    return {
      created: false,
      eventId: "",
      conversionEventRowId: null,
      deliveryStatus: "failed",
      capiMode: "live",
      releaseStatus: null,
      holdReason: "conversion_event_not_found",
    };
  }

  const event = row.data;
  const releaseStatus = event.release_status as ConversionReleaseStatus;

  if (event.sent_at) {
    return {
      created: false,
      eventId: event.event_id,
      conversionEventRowId: event.id,
      deliveryStatus: event.status,
      capiMode: "live",
      releaseStatus,
      holdReason: null,
    };
  }
  if (releaseStatus !== "released") {
    logger.warn("conversion.purchase.send_blocked_not_released", {
      conversion_event_id: event.id,
      event_id: event.event_id,
      release_status: releaseStatus,
    });
    return {
      created: false,
      eventId: event.event_id,
      conversionEventRowId: event.id,
      deliveryStatus: event.status,
      capiMode: "dry_run",
      releaseStatus,
      holdReason: "not_released",
    };
  }

  const [metaIntegration, tiktokIntegration] = await Promise.all([
    resolveProviderIntegration(input.admin, input.agencyId, input.storeId, "meta"),
    resolveProviderIntegration(input.admin, input.agencyId, input.storeId, "tiktok"),
  ]);

  const metaCreds = resolveMetaCapiCredentials(
    metaIntegration?.settings ?? null,
    metaIntegration?.metadata ?? null,
  );
  const tiktokCreds = resolveTikTokEventsCredentials(
    tiktokIntegration?.settings ?? null,
    tiktokIntegration?.metadata ?? null,
  );

  if (!metaCreds) {
    logger.warn("conversion.purchase.missing_capi_credentials", {
      store_id: input.storeId,
      order_id: event.order_id,
      event_id: event.event_id,
      has_meta_integration: Boolean(metaIntegration),
    });
  }
  if (!tiktokCreds) {
    logger.debug("conversion.purchase.tiktok_dry_run_credentials", {
      store_id: input.storeId,
      order_id: event.order_id,
      event_id: event.event_id,
      has_tiktok_integration: Boolean(tiktokIntegration),
    });
  }

  const resolved = await resolveOrderCustomerContact(
    input.admin,
    input.storeId,
    event.order_id,
  );
  const contact = mergePurchaseContact(resolved);

  const eventTime = event.event_time ?? new Date().toISOString();
  const eventTimeUnix = Math.floor(new Date(eventTime).getTime() / 1000);
  const value = Number(event.value ?? 0);
  const currency = (event.currency_code ?? "PEN").slice(0, 3).toUpperCase();
  const platform: AdPlatform = tiktokCreds && !metaCreds ? "tiktok" : "meta";
  const source = readCustomDataSource(event.custom_data);
  const contactFlags = purchaseContactFlags(contact);

  const sharedPayload = {
    eventId: event.event_id,
    value,
    currency,
    orderId: event.order_id,
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
      countryCode: contact.countryCode,
      externalId: event.order_id,
    }),
  ]);

  const aggregated = aggregateDelivery({ meta, tiktok });
  const customData = {
    dry_run: aggregated.capiMode === "dry_run",
    source,
    order_id: event.order_id,
    no_integration: !metaIntegration && !tiktokIntegration,
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

  const attemptsAfter = (event.attempts ?? 0) + 1;
  // Not sent → schedule the sweep retry (1 min base, capped at 1 h) until
  // attempts are exhausted; then next_retry_at clears and only manual retry remains.
  const nextRetryAt =
    aggregated.status === "sent" || attemptsAfter >= (event.max_attempts ?? 5)
      ? null
      : computeRetryAt(
          attemptsAfter,
          60_000,
          60 * 60_000,
          `conversion:${event.id}`,
        ).toISOString();

  await input.admin
    .from("conversion_events")
    .update({
      status: aggregated.status,
      attempts: attemptsAfter,
      next_retry_at: nextRetryAt,
      sent_at: aggregated.status === "sent" ? new Date().toISOString() : null,
      last_error_message: aggregated.lastError,
      response_payload: responsePayload,
      custom_data: customData,
      user_data: contactFlags as Json,
      platform,
      updated_at: new Date().toISOString(),
    })
    .eq("id", event.id)
    .eq("store_id", input.storeId);

  logger.info("conversion.purchase.recorded", {
    event_id: event.event_id,
    order_id: event.order_id,
    status: aggregated.status,
    capi_mode: aggregated.capiMode,
    meta_mode: meta.mode,
    tiktok_mode: tiktok.mode,
    conversion_event_id: event.id,
    email_present: contactFlags.email_present,
    phone_present: contactFlags.phone_present,
    user_data: contactFlags,
  });

  return {
    created: false,
    eventId: event.event_id,
    conversionEventRowId: event.id,
    deliveryStatus: aggregated.status,
    capiMode: aggregated.capiMode,
    releaseStatus: "released",
    holdReason: null,
  };
}

/**
 * Release gate entry point (hold → filter → released → send).
 *
 * Ensures a Purchase candidate row exists (deduped by event_id), runs the
 * release filter against the current order state, and only when the candidate
 * is labeled `released` performs the live Meta CAPI + TikTok Events send.
 * Held candidates stay `queued` + `pending_review` for the manual queue;
 * `rejected` candidates are never resent.
 */
export async function recordPurchaseConversionEvent(
  input: RecordPurchaseConversionInput,
): Promise<RecordPurchaseConversionResult> {
  const eventId = purchaseConversionEventId(input.orderId);
  const eventTime = input.eventTime ?? new Date().toISOString();

  const existing = await input.admin
    .from("conversion_events")
    .select("id, status, sent_at, release_status")
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
      releaseStatus: (existing.data.release_status as ConversionReleaseStatus) ?? "released",
      holdReason: null,
    };
  }

  if (existing.data?.release_status === "rejected") {
    logger.info("conversion.purchase.skip_rejected", {
      event_id: eventId,
      order_id: input.orderId,
      conversion_event_id: existing.data.id,
    });
    return {
      created: false,
      eventId,
      conversionEventRowId: existing.data.id,
      deliveryStatus: existing.data.status,
      capiMode: "dry_run",
      releaseStatus: "rejected",
      holdReason: "manual_reject",
    };
  }

  // Release filter: judged on the live order state, not the trigger.
  const orderRes = await input.admin
    .from("orders")
    .select("order_status, payment_status, confirmation_status")
    .eq("id", input.orderId)
    .eq("store_id", input.storeId)
    .maybeSingle();

  const decision = evaluatePurchaseRelease({
    value: input.value,
    orderStatus: orderRes.data?.order_status ?? null,
    paymentStatus: orderRes.data?.payment_status ?? null,
    confirmationStatus: orderRes.data?.confirmation_status ?? null,
  });

  // A manual release must survive later triggers; holds may be upgraded.
  const wasReleased = existing.data?.release_status === "released";
  const releaseStatus: ConversionReleaseStatus =
    wasReleased || decision.release ? "released" : "pending_review";
  const holdReason = releaseStatus === "released" ? null : decision.reason;

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

  const resolved = await resolveOrderCustomerContact(
    input.admin,
    input.storeId,
    input.orderId,
  );
  const contact = mergePurchaseContact(resolved, {
    email: input.email,
    phone: input.phone,
    countryCode: input.countryCode,
    city: input.city,
  });
  const contactFlags = purchaseContactFlags(contact);

  const currency = input.currencyCode.slice(0, 3).toUpperCase();
  const platform: AdPlatform =
    tiktokIntegration && !metaIntegration ? "tiktok" : "meta";
  const queuedCustomData = {
    dry_run: false,
    source: input.source ?? "cash_collected",
    order_id: input.orderId,
    no_integration: !integration,
  } as Json;

  let rowId = existing.data?.id ?? null;
  let created = false;

  if (rowId) {
    await input.admin
      .from("conversion_events")
      .update({
        status: "queued" satisfies DeliveryStatus,
        release_status: releaseStatus,
        hold_reason: holdReason,
        released_at:
          releaseStatus === "released" && !wasReleased ? new Date().toISOString() : undefined,
        value: input.value,
        currency_code: currency,
        event_time: eventTime,
        platform,
        user_data: contactFlags as Json,
        updated_at: new Date().toISOString(),
      })
      .eq("id", rowId)
      .eq("store_id", input.storeId);
  } else {
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
        status: "queued" satisfies DeliveryStatus,
        release_status: releaseStatus,
        hold_reason: holdReason,
        released_at: releaseStatus === "released" ? new Date().toISOString() : null,
        attempts: 0,
        value: input.value,
        currency_code: currency,
        user_data: contactFlags as Json,
        custom_data: queuedCustomData,
      })
      .select("id")
      .maybeSingle();

    if (inserted.error) {
      // Unique event_id race: another trigger inserted first — reuse its row.
      const again = await input.admin
        .from("conversion_events")
        .select("id, status, sent_at, release_status")
        .eq("store_id", input.storeId)
        .eq("event_id", eventId)
        .maybeSingle();
      if (again.data?.sent_at) {
        return {
          created: false,
          eventId,
          conversionEventRowId: again.data.id,
          deliveryStatus: again.data.status,
          capiMode: "live",
          releaseStatus: (again.data.release_status as ConversionReleaseStatus) ?? "released",
          holdReason: null,
        };
      }
      if (!again.data) {
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
          capiMode: "dry_run",
          releaseStatus: null,
          holdReason: "insert_failed",
        };
      }
      rowId = again.data.id;
    } else {
      rowId = inserted.data?.id ?? null;
      created = true;
    }
  }

  if (!rowId) {
    return {
      created: false,
      eventId,
      conversionEventRowId: null,
      deliveryStatus: "failed",
      capiMode: "dry_run",
      releaseStatus: null,
      holdReason: "insert_failed",
    };
  }

  if (releaseStatus !== "released") {
    logger.info("conversion.purchase.held", {
      event_id: eventId,
      order_id: input.orderId,
      conversion_event_id: rowId,
      hold_reason: holdReason,
      source: input.source ?? "cash_collected",
      email_present: contactFlags.email_present,
      phone_present: contactFlags.phone_present,
      user_data: contactFlags,
    });
    return {
      created,
      eventId,
      conversionEventRowId: rowId,
      deliveryStatus: "queued",
      capiMode: "dry_run",
      releaseStatus,
      holdReason,
    };
  }

  logger.info("conversion.purchase.released", {
    event_id: eventId,
    order_id: input.orderId,
    conversion_event_id: rowId,
    release_reason: decision.release ? decision.reason : "previously_released",
    released_by: "auto_filter",
    email_present: contactFlags.email_present,
    phone_present: contactFlags.phone_present,
    user_data: contactFlags,
  });

  const sendResult = await sendQueuedPurchaseConversion({
    admin: input.admin,
    agencyId: input.agencyId,
    storeId: input.storeId,
    conversionEventRowId: rowId,
  });

  return { ...sendResult, created };
}
