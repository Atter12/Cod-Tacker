import "server-only";

import { FlipyPartnerApiError } from "@/lib/integrations/flipy/errors";
import type { FlipyEscenarioPago } from "@/lib/integrations/flipy/resolve-payment";
import {
  buildFlipyCreateEnvioRequestBody,
  buildFlipyCotizarRequestBody,
  buildFlipyProvisionRequestBody,
  buildFlipyCalificarEnvioRequestBody,
  buildFlipyCancelEnvioRequestBody,
  buildFlipyConfirmarDevolucionRequestBody,
  readFlipyCalificarEnvioSuccessResult,
  readFlipyCancelEnvioBlockedDetails,
  readFlipyCancelEnvioSuccessResult,
  readFlipyConfirmarDevolucionSuccessResult,
  readFlipyCreateEnvioResult,
  readFlipyCotizarEnvioResult,
  readFlipyEnvioByExternalOrderResult,
  readFlipyEnvioSummaryResult,
  readFlipySaldoOperaciones,
  readFlipySaldoReservado,
  readFlipySaldoWarningBajo,
  readFlipyWalletSaldoResult,
  buildFlipyTransferGananciasRequestBody,
  readFlipyTransferGananciasSuccessResult,
  buildFlipyActivateAccountInitRequestBody,
  readFlipyActivateAccountInitResult,
  type FlipyCalificarEnvioInput,
  type FlipyCalificarEnvioSuccessResult,
  type FlipyCancelEnvioInput,
  type FlipyCancelEnvioSuccessResult,
  type FlipyConfirmarDevolucionInput,
  type FlipyConfirmarDevolucionSuccessResult,
  type FlipyCotizarEnvioInput,
  type FlipyCotizarEnvioResult,
  type FlipyCreateEnvioPartnerInput,
  type FlipyEnvioByExternalOrderResult,
  type FlipyEnvioSummaryResult,
  type FlipyFleteQuote,
  type FlipyAssignedMotorizado,
  type FlipyOperationalFulfillmentMode,
  type FlipyPackageCareId,
  type FlipyPackageSize,
  type FlipyShopifyPaymentInput,
  type FlipyActivateAccountInitInput,
  type FlipyActivateAccountInitResult,
  type FlipyTransferGananciasInput,
  type FlipyTransferGananciasSuccessResult,
  type FlipyTypeMode,
  type FlipyWalletSaldoResult,
} from "@/lib/integrations/flipy/partner-contract";

export type {
  FlipyCalificarEnvioInput,
  FlipyCalificarEnvioSuccessResult,
  FlipyCancelEnvioInput,
  FlipyCancelEnvioSuccessResult,
  FlipyConfirmarDevolucionInput,
  FlipyConfirmarDevolucionSuccessResult,
  FlipyCotizarEnvioInput,
  FlipyCotizarEnvioResult,
  FlipyEnvioByExternalOrderResult,
  FlipyEnvioSummaryResult,
  FlipyFleteQuote,
  FlipyOperationalFulfillmentMode,
  FlipyPackageCareId,
  FlipyPackageSize,
  FlipyShopifyPaymentInput,
  FlipyActivateAccountInitInput,
  FlipyActivateAccountInitResult,
  FlipyTransferGananciasInput,
  FlipyTransferGananciasSuccessResult,
  FlipyTypeMode,
  FlipyWalletSaldoResult,
} from "@/lib/integrations/flipy/partner-contract";

export type FlipyPartnerClientConfig = {
  baseUrl: string;
  partnerKey: string;
  partnerId?: string;
  externalStoreId: string;
};

export type FlipyProvisionInput = {
  nombre: string;
  contactEmail: string;
  ruc?: string | null;
  telefono?: string | null;
  originAddress: string;
  originLat: number;
  originLng: number;
  webhookUrl?: string | null;
};

export type FlipyProvisionResult = {
  tiendaId: string;
  saldoOperaciones?: number | null;
  saldoReservado?: number | null;
};

export type FlipyCreateEnvioInput = Omit<FlipyCreateEnvioPartnerInput, "externalStoreId">;

export type FlipyCreateEnvioResult = {
  envioId: string;
  estado: string;
  contractVersion?: string | null;
  fulfillmentMode?: FlipyOperationalFulfillmentMode | null;
  trackingToken?: string | null;
  trackingUrl?: string | null;
  escenarioPago?: string | null;
  appDeepLink?: string | null;
  appWebUrl?: string | null;
  pujasDeepLink?: string | null;
  pujasWebUrl?: string | null;
  fleteQuote?: FlipyFleteQuote | null;
  assignedMotorizado?: FlipyAssignedMotorizado | null;
};

export type FlipySaldoResult = FlipyWalletSaldoResult & {
  /** @deprecated Use billeteraOperaciones */
  saldoOperaciones: number;
  /** @deprecated Use billeteraReservado */
  saldoReservado?: number | null;
  warningBajo?: boolean;
};

export type FlipyWidgetTokenInput = {
  scope?: string[];
  orderContext: {
    orderId: string;
    externalOrderId: string;
    envioId?: string;
    prefillAddress?: string;
    prefillLat?: number;
    prefillLng?: number;
  };
};

export type FlipyWidgetTokenResult = {
  token: string;
  expiresAt?: string | null;
  embedUrl?: string | null;
  ubicacionEmbedUrl?: string | null;
  recargaEmbedUrl?: string | null;
  pujasEmbedUrl?: string | null;
};

function asRecord(raw: unknown): Record<string, unknown> | null {
  if (raw && typeof raw === "object" && !Array.isArray(raw)) return raw as Record<string, unknown>;
  return null;
}

function readString(bag: Record<string, unknown>, ...keys: string[]): string | null {
  for (const key of keys) {
    const v = bag[key];
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return null;
}

export function createFlipyPartnerClient(config: FlipyPartnerClientConfig) {
  const partnerId = config.partnerId ?? "codtracked";

  async function request<T>(
    path: string,
    options: {
      method?: string;
      body?: unknown;
      idempotencyKey?: string;
    } = {},
  ): Promise<T> {
    const url = `${config.baseUrl.replace(/\/$/, "")}${path.startsWith("/") ? path : `/${path}`}`;
    const headers: Record<string, string> = {
      Accept: "application/json",
      "Content-Type": "application/json",
      "X-Partner-Key": config.partnerKey,
      "X-Partner-Id": partnerId,
      "X-External-Store-Id": config.externalStoreId,
    };
    if (options.idempotencyKey) {
      headers["X-Idempotency-Key"] = options.idempotencyKey;
    }

    const res = await fetch(url, {
      method: options.method ?? (options.body ? "POST" : "GET"),
      headers,
      body: options.body ? JSON.stringify(options.body) : undefined,
      cache: "no-store",
    });

    const text = await res.text();
    let json: unknown = null;
    if (text.trim()) {
      try {
        json = JSON.parse(text) as unknown;
      } catch {
        json = { raw: text };
      }
    }

    if (!res.ok) {
      const bag = asRecord(json);
      const code = bag ? readString(bag, "code", "errorCode") : null;
      const message =
        (bag ? readString(bag, "message", "error", "detail") : null) ||
        `Flipy API ${res.status}`;
      const details = bag ? readFlipyCancelEnvioBlockedDetails(bag.details) ?? undefined : undefined;
      throw new FlipyPartnerApiError(message, res.status, code ?? undefined, details);
    }

    return json as T;
  }

  return {
    async provisionTienda(input: FlipyProvisionInput, idempotencyKey: string): Promise<FlipyProvisionResult> {
      const body = buildFlipyProvisionRequestBody({
        externalStoreId: config.externalStoreId,
        nombre: input.nombre,
        contactEmail: input.contactEmail,
        telefono: input.telefono,
        ruc: input.ruc,
        originAddress: input.originAddress,
        originLat: input.originLat,
        originLng: input.originLng,
        webhookUrl: input.webhookUrl,
      });

      const raw = await request<unknown>("/api/partner/tiendas", {
        method: "POST",
        idempotencyKey,
        body,
      });
      const bag = asRecord(raw) ?? {};
      const tiendaId = readString(bag, "tiendaId", "tienda_id", "id");
      if (!tiendaId) {
        throw new FlipyPartnerApiError("Flipy no devolvió tiendaId", 502);
      }
      const saldoSource = asRecord(bag.saldo) ?? bag;
      return {
        tiendaId,
        saldoOperaciones: readFlipySaldoOperaciones(saldoSource),
        saldoReservado: readFlipySaldoReservado(saldoSource),
      };
    },

    async registerWebhook(
      tiendaId: string,
      input: { webhookUrl: string; webhookSecret: string },
    ): Promise<void> {
      await request(`/api/partner/tiendas/${encodeURIComponent(tiendaId)}/webhook`, {
        method: "PUT",
        body: {
          webhookUrl: input.webhookUrl,
          webhookSecret: input.webhookSecret,
        },
      });
    },

    async getSaldo(tiendaId: string): Promise<FlipySaldoResult> {
      const raw = await request<unknown>(`/api/partner/tiendas/${encodeURIComponent(tiendaId)}/saldo`);
      const parsed = readFlipyWalletSaldoResult(raw);
      return {
        ...parsed,
        saldoOperaciones: parsed.billeteraOperaciones,
        saldoReservado: parsed.billeteraReservado,
        warningBajo: parsed.warningBajo,
      };
    },

    async transferirGananciasAOperaciones(
      input: FlipyTransferGananciasInput,
      idempotencyKey: string,
    ): Promise<FlipyTransferGananciasSuccessResult> {
      const raw = await request<unknown>("/api/partner/wallet/transferir-a-operaciones", {
        method: "POST",
        idempotencyKey,
        body: buildFlipyTransferGananciasRequestBody(input),
      });
      const parsed = readFlipyTransferGananciasSuccessResult(raw);
      if (!parsed) {
        throw new FlipyPartnerApiError("Flipy no devolvió respuesta de transferencia", 502);
      }
      return parsed;
    },

    async initActivateAccount(
      input: FlipyActivateAccountInitInput,
    ): Promise<FlipyActivateAccountInitResult> {
      const raw = await request<unknown>("/api/partner/activate-account/init", {
        method: "POST",
        body: buildFlipyActivateAccountInitRequestBody(input),
      });
      const parsed = readFlipyActivateAccountInitResult(raw);
      if (!parsed) {
        throw new FlipyPartnerApiError("Flipy no devolvió token de activación", 502);
      }
      return parsed;
    },

    async issueWidgetToken(input: FlipyWidgetTokenInput): Promise<FlipyWidgetTokenResult> {
      const raw = await request<unknown>("/api/partner/widgets/token", {
        method: "POST",
        body: {
          scope: input.scope ?? ["location_picker"],
          orderContext: input.orderContext,
        },
      });
      const bag = asRecord(raw) ?? {};
      const token = readString(bag, "token", "widgetToken", "jwt");
      if (!token) {
        throw new FlipyPartnerApiError("Flipy no devolvió token de widget", 502);
      }
      return {
        token,
        embedUrl: readString(bag, "embedUrl", "embed_url", "url"),
        ubicacionEmbedUrl: readString(bag, "ubicacionEmbedUrl", "ubicacion_embed_url"),
        recargaEmbedUrl: readString(bag, "recargaEmbedUrl", "recarga_embed_url"),
        pujasEmbedUrl: readString(bag, "pujasEmbedUrl", "pujas_embed_url"),
        expiresAt: readString(bag, "expiresAt", "expires_at"),
      };
    },

    async cotizarEnvio(input: FlipyCotizarEnvioInput): Promise<FlipyCotizarEnvioResult> {
      const raw = await request<unknown>("/api/partner/envios/cotizar", {
        method: "POST",
        body: buildFlipyCotizarRequestBody(input),
      });
      const parsed = readFlipyCotizarEnvioResult(raw);
      if (!parsed) {
        throw new FlipyPartnerApiError("Flipy no devolvió fleteQuote", 502);
      }
      return parsed;
    },

    async geocodeAddress(input: string): Promise<{ address: string; lat: number; lng: number } | null> {
      const query = input.trim();
      if (query.length < 4) return null;

      const autocomplete = await request<{
        success?: boolean;
        predictions?: Array<{ placeId?: string; description?: string }>;
      }>(`/api/partner/maps/autocomplete?input=${encodeURIComponent(query)}`, { method: "GET" });

      const placeId = autocomplete.predictions?.[0]?.placeId;
      if (!placeId) return null;

      const details = await request<{
        success?: boolean;
        place?: { address?: string; lat?: number; lng?: number };
      }>(`/api/partner/maps/place-details?placeId=${encodeURIComponent(placeId)}`, { method: "GET" });

      const place = details.place;
      if (!place || typeof place.lat !== "number" || typeof place.lng !== "number") return null;
      const address = place.address?.trim() || autocomplete.predictions?.[0]?.description?.trim() || query;
      return { address, lat: place.lat, lng: place.lng };
    },

    async reverseGeocode(
      lat: number,
      lng: number,
    ): Promise<{ address: string; lat: number; lng: number } | null> {
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
      const raw = await request<unknown>(
        `/api/partner/maps/reverse-geocode?lat=${encodeURIComponent(String(lat))}&lng=${encodeURIComponent(String(lng))}`,
        { method: "GET" },
      );
      const bag = asRecord(raw) ?? {};
      const place = asRecord(bag.place) ?? bag;
      const address =
        readString(place, "address", "formattedAddress", "formatted_address", "displayName") ??
        readString(bag, "address", "formattedAddress");
      const outLat = typeof place.lat === "number" ? place.lat : typeof bag.lat === "number" ? bag.lat : lat;
      const outLng = typeof place.lng === "number" ? place.lng : typeof bag.lng === "number" ? bag.lng : lng;
      if (!address) return null;
      return { address, lat: outLat, lng: outLng };
    },

    async createEnvio(input: FlipyCreateEnvioInput, idempotencyKey: string): Promise<FlipyCreateEnvioResult> {
      const raw = await request<unknown>("/api/partner/envios", {
        method: "POST",
        idempotencyKey,
        body: buildFlipyCreateEnvioRequestBody({
          ...input,
          externalStoreId: config.externalStoreId,
        }),
      });
      const parsed = readFlipyCreateEnvioResult(raw);
      if (!parsed) {
        throw new FlipyPartnerApiError("Flipy no devolvió envioId", 502);
      }
      return parsed;
    },

    async getEnvioByExternalOrder(externalOrderId: string): Promise<FlipyEnvioByExternalOrderResult> {
      const query = encodeURIComponent(externalOrderId.trim());
      const raw = await request<unknown>(
        `/api/partner/envios/by-external-order?externalOrderId=${query}`,
        { method: "GET" },
      );
      const parsed = readFlipyEnvioByExternalOrderResult(raw);
      if (!parsed) {
        throw new FlipyPartnerApiError("Flipy no devolvió envioId", 502);
      }
      return parsed;
    },

    async getEnvio(envioId: string): Promise<FlipyEnvioSummaryResult> {
      const raw = await request<unknown>(
        `/api/partner/envios/${encodeURIComponent(envioId)}`,
        { method: "GET" },
      );
      const parsed = readFlipyEnvioSummaryResult(raw);
      if (!parsed) {
        throw new FlipyPartnerApiError("Flipy no devolvió envioId", 502);
      }
      return parsed;
    },

    async cancelEnvio(
      envioId: string,
      input: FlipyCancelEnvioInput = {},
    ): Promise<FlipyCancelEnvioSuccessResult> {
      const body = buildFlipyCancelEnvioRequestBody(input);
      const raw = await request<unknown>(
        `/api/partner/envios/${encodeURIComponent(envioId)}/cancelar`,
        {
          method: "POST",
          body: body ?? {},
        },
      );
      const parsed = readFlipyCancelEnvioSuccessResult(raw);
      if (!parsed) {
        throw new FlipyPartnerApiError("Flipy no devolvió respuesta de cancelación", 502);
      }
      return parsed;
    },

    async confirmarDevolucion(
      envioId: string,
      input: FlipyConfirmarDevolucionInput = {},
    ): Promise<FlipyConfirmarDevolucionSuccessResult> {
      const body = buildFlipyConfirmarDevolucionRequestBody(input);
      const raw = await request<unknown>(
        `/api/partner/envios/${encodeURIComponent(envioId)}/confirmar-devolucion`,
        {
          method: "POST",
          body: body ?? {},
        },
      );
      const parsed = readFlipyConfirmarDevolucionSuccessResult(raw);
      if (!parsed) {
        throw new FlipyPartnerApiError("Flipy no devolvió respuesta de devolución", 502);
      }
      return parsed;
    },

    async calificarEnvio(
      envioId: string,
      input: FlipyCalificarEnvioInput,
    ): Promise<FlipyCalificarEnvioSuccessResult> {
      const raw = await request<unknown>(
        `/api/partner/envios/${encodeURIComponent(envioId)}/calificar`,
        {
          method: "POST",
          body: buildFlipyCalificarEnvioRequestBody(input),
        },
      );
      const parsed = readFlipyCalificarEnvioSuccessResult(raw);
      if (!parsed) {
        throw new FlipyPartnerApiError("Flipy no devolvió respuesta de calificación", 502);
      }
      return parsed;
    },
  };
}

// Re-export for callers that need escenario typing alongside client helpers.
export type { FlipyEscenarioPago };
