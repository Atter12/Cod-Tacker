import "server-only";

import type { FlipyEscenarioPago } from "@/lib/integrations/flipy/resolve-payment";
import {
  buildFlipyProvisionRequestBody,
  readFlipySaldoOperaciones,
  readFlipySaldoReservado,
  readFlipySaldoWarningBajo,
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

export type FlipyCreateEnvioInput = {
  externalOrderId: string;
  orderNumber?: string | null;
  escenarioPago: FlipyEscenarioPago;
  codAmount?: number | null;
  price?: number | null;
  originAddress: string;
  originLat: number;
  originLng: number;
  originContact?: string | null;
  originPhone?: string | null;
  destinationAddress: string;
  destinationLat: number;
  destinationLng: number;
  destinationContact?: string | null;
  destinationPhone?: string | null;
  shopifyPayment?: Record<string, unknown>;
};

export type FlipyCreateEnvioResult = {
  envioId: string;
  estado: string;
  trackingToken?: string | null;
  trackingUrl?: string | null;
  escenarioPago?: string | null;
};

export type FlipySaldoResult = {
  saldoOperaciones: number;
  saldoReservado?: number | null;
  warningBajo?: boolean;
};

export class FlipyPartnerApiError extends Error {
  readonly status: number;
  readonly code?: string;

  constructor(message: string, status: number, code?: string) {
    super(message);
    this.name = "FlipyPartnerApiError";
    this.status = status;
    this.code = code;
  }
}

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
      throw new FlipyPartnerApiError(message, res.status, code ?? undefined);
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
      return {
        saldoOperaciones: readFlipySaldoOperaciones(raw),
        saldoReservado: readFlipySaldoReservado(raw),
        warningBajo: readFlipySaldoWarningBajo(raw),
      };
    },

    async createEnvio(input: FlipyCreateEnvioInput, idempotencyKey: string): Promise<FlipyCreateEnvioResult> {
      const raw = await request<unknown>("/api/partner/envios", {
        method: "POST",
        idempotencyKey,
        body: {
          externalStoreId: config.externalStoreId,
          externalOrderId: input.externalOrderId,
          orderNumber: input.orderNumber ?? undefined,
          escenarioPago: input.escenarioPago,
          codAmount: input.codAmount ?? undefined,
          price: input.price ?? undefined,
          originAddress: input.originAddress,
          originLat: input.originLat,
          originLng: input.originLng,
          originContact: input.originContact ?? undefined,
          originPhone: input.originPhone ?? undefined,
          destinationAddress: input.destinationAddress,
          destinationLat: input.destinationLat,
          destinationLng: input.destinationLng,
          destinationContact: input.destinationContact ?? undefined,
          destinationPhone: input.destinationPhone ?? undefined,
          shopifyPayment: input.shopifyPayment ?? undefined,
        },
      });
      const bag = asRecord(raw) ?? {};
      const envioId = readString(bag, "envioId", "envio_id", "id");
      if (!envioId) {
        throw new FlipyPartnerApiError("Flipy no devolvió envioId", 502);
      }
      return {
        envioId,
        estado: readString(bag, "estado", "status") ?? "PENDIENTE_PUJAS",
        trackingToken: readString(bag, "trackingToken", "tracking_token"),
        trackingUrl: readString(bag, "trackingUrl", "tracking_url"),
        escenarioPago: readString(bag, "escenarioPago", "escenario_pago"),
      };
    },
  };
}
