"use server";

import { actionFail, actionOk, type ActionResult } from "@/lib/actions/action-result";
import { IntegrationError, ValidationError } from "@/lib/errors";
import { createFlipyPartnerClient } from "@/lib/integrations/flipy/client";
import {
  readFlipyTiendaId,
  resolveFlipyPartnerKeyFromIntegration,
} from "@/lib/integrations/flipy/credentials";
import { buildFlipyLocationEmbedUrl, buildFlipyWalletEmbedUrl, buildFlipyBidsEmbedUrl, ensureFlipyMapWheelZoomParams, resolveFlipyScopedEmbedUrl } from "@/lib/integrations/flipy/embed-urls";
import { getFlipyEnv } from "@/lib/integrations/flipy/env";
import { resolveFlipyIntegrationForStore } from "@/lib/integrations/flipy/webhook-ingress";
import { getIntegrationRuntimeMode } from "@/lib/integrations/registry";
import { assertCanManageOrders } from "@/lib/orders/transitions";
import { can } from "@/lib/permissions/can";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireStoreAccess } from "@/lib/tenant/require-store-access";
import { requireUser } from "@/lib/auth/require-user";

export type FlipyWidgetTokenResult = {
  token: string;
  embedUrl: string;
  embedOrigin: string;
};

export async function issueFlipyWidgetTokenAction(input: {
  agencySlug: string;
  storeSlug: string;
  orderId?: string | null;
  envioId?: string | null;
  prefillAddress?: string | null;
  prefillLat?: number | null;
  prefillLng?: number | null;
  scope?: "location_picker" | "wallet_topup" | "bids_panel";
}): Promise<ActionResult<FlipyWidgetTokenResult>> {
  try {
    if (getIntegrationRuntimeMode() !== "live") {
      throw new ValidationError("Widget Flipy requiere INTEGRATION_MODE=live.");
    }

    await requireUser();
    const membership = await requireStoreAccess(input.agencySlug, input.storeSlug);
    const scope = input.scope ?? "location_picker";
    if (scope === "wallet_topup") {
      if (!can(membership.roles, "integrations.view")) {
        throw new ValidationError("No tienes permiso para recargar Flipy.");
      }
    } else if (scope === "bids_panel") {
      if (!can(membership.roles, "orders.view") && !can(membership.roles, "orders.manage")) {
        throw new ValidationError("No tienes permiso para ver pujas Flipy.");
      }
    } else {
      assertCanManageOrders(can(membership.roles, "orders.manage"));
    }
    if (!membership.storeId) throw new ValidationError("Tienda inválida.");

    const admin = createAdminClient();
    let orderExternalId = `store:${membership.storeId}`;
    let flipyEnvioId = input.envioId?.trim() || null;
    if (input.orderId) {
      const orderRes = await admin
        .from("orders")
        .select("id, external_order_id, metadata")
        .eq("id", input.orderId)
        .eq("store_id", membership.storeId)
        .maybeSingle();
      if (!orderRes.data) throw new ValidationError("Pedido no encontrado.");
      orderExternalId = orderRes.data.external_order_id;
      if (!flipyEnvioId && orderRes.data.metadata && typeof orderRes.data.metadata === "object") {
        const meta = orderRes.data.metadata as Record<string, unknown>;
        if (typeof meta.flipy_envio_id === "string" && meta.flipy_envio_id.trim()) {
          flipyEnvioId = meta.flipy_envio_id.trim();
        }
      }
    } else if (scope === "location_picker") {
      throw new ValidationError("El mapa Flipy requiere un pedido.");
    }

    if (scope === "bids_panel" && !flipyEnvioId) {
      throw new ValidationError("El panel de pujas requiere un envío Flipy (envioId).");
    }

    const widgetScope =
      scope === "wallet_topup"
        ? ["wallet_topup"]
        : scope === "bids_panel"
          ? ["bids_panel"]
          : ["location_picker"];

    const integration = await resolveFlipyIntegrationForStore(
      admin,
      membership.agencyId,
      membership.storeId,
    );
    if (!integration || integration.status === "disconnected") {
      throw new IntegrationError("Conecta Flipy en Integraciones antes de usar el mapa.");
    }

    const partnerKey = resolveFlipyPartnerKeyFromIntegration(integration);
    if (!partnerKey) {
      throw new IntegrationError("FLIPY_PARTNER_API_KEY no configurada.");
    }

    const flipyTiendaId = readFlipyTiendaId(integration.settings) ?? integration.external_account_id;
    if (!flipyTiendaId) {
      throw new IntegrationError("Integración Flipy sin tiendaId. Reconecta Flipy.");
    }

    const env = getFlipyEnv();
    const client = createFlipyPartnerClient({
      baseUrl: env.apiBaseUrl,
      partnerKey,
      partnerId: env.partnerId,
      externalStoreId: membership.storeId,
    });

    const issued = await client.issueWidgetToken({
      scope: widgetScope,
      orderContext: {
        orderId: input.orderId ?? membership.storeId,
        externalOrderId: input.orderId ? `shopify:${orderExternalId}` : `codtracked:store:${membership.storeId}`,
        envioId: flipyEnvioId ?? undefined,
        prefillAddress: input.prefillAddress?.trim() || undefined,
        prefillLat: input.prefillLat ?? undefined,
        prefillLng: input.prefillLng ?? undefined,
      },
    });

    let embedUrl: string;
    try {
      embedUrl =
        scope === "wallet_topup"
          ? resolveFlipyScopedEmbedUrl({
              scope: "wallet_topup",
              apiEmbedUrl: issued.recargaEmbedUrl,
              embedOrigin: env.embedOrigin,
              appOrigin: env.appOrigin,
              buildFallback: () =>
                buildFlipyWalletEmbedUrl({
                  embedOrigin: env.embedOrigin,
                  token: issued.token,
                }),
            })
          : scope === "bids_panel"
            ? resolveFlipyScopedEmbedUrl({
                scope: "bids_panel",
                apiEmbedUrl: issued.pujasEmbedUrl,
                embedOrigin: env.embedOrigin,
                appOrigin: env.appOrigin,
                buildFallback: () =>
                  buildFlipyBidsEmbedUrl({
                    embedOrigin: env.embedOrigin,
                    token: issued.token,
                    envioId: flipyEnvioId,
                  }),
              })
            : resolveFlipyScopedEmbedUrl({
                scope: "location_picker",
                apiEmbedUrl: issued.ubicacionEmbedUrl,
                embedOrigin: env.embedOrigin,
                appOrigin: env.appOrigin,
                buildFallback: () =>
                  buildFlipyLocationEmbedUrl({
                    embedOrigin: env.embedOrigin,
                    token: issued.token,
                    prefillAddress: input.prefillAddress,
                    prefillLat: input.prefillLat,
                    prefillLng: input.prefillLng,
                  }),
              });
      if (scope === "location_picker") {
        embedUrl = ensureFlipyMapWheelZoomParams(embedUrl);
      }
    } catch (error) {
      throw new IntegrationError(
        error instanceof Error ? error.message : "No se pudo resolver la URL del embed Flipy.",
      );
    }

    let resolvedEmbedOrigin = env.embedOrigin;
    try {
      resolvedEmbedOrigin = new URL(embedUrl).origin;
    } catch {
      // keep env default
    }

    // Ensure bids iframe always carries envioId (API URL may omit it).
    if (scope === "bids_panel" && flipyEnvioId) {
      try {
        const parsed = new URL(embedUrl);
        if (!parsed.searchParams.get("envioId")) {
          parsed.searchParams.set("envioId", flipyEnvioId);
          embedUrl = parsed.toString();
        }
      } catch {
        // keep resolved URL
      }
    }

    return actionOk({
      token: issued.token,
      embedUrl,
      embedOrigin: resolvedEmbedOrigin,
    });
  } catch (error) {
    return actionFail(error);
  }
}

export async function reverseGeocodeFlipyLocationAction(input: {
  agencySlug: string;
  storeSlug: string;
  lat: number;
  lng: number;
}): Promise<ActionResult<{ address: string; lat: number; lng: number }>> {
  try {
    if (getIntegrationRuntimeMode() !== "live") {
      throw new ValidationError("Reverse geocode Flipy requiere INTEGRATION_MODE=live.");
    }
    await requireUser();
    const membership = await requireStoreAccess(input.agencySlug, input.storeSlug);
    assertCanManageOrders(can(membership.roles, "orders.manage"));
    if (!membership.storeId) throw new ValidationError("Tienda inválida.");
    if (!Number.isFinite(input.lat) || !Number.isFinite(input.lng)) {
      throw new ValidationError("Coordenadas inválidas.");
    }

    const admin = createAdminClient();
    const integration = await resolveFlipyIntegrationForStore(
      admin,
      membership.agencyId,
      membership.storeId,
    );
    if (!integration || integration.status === "disconnected") {
      throw new IntegrationError("Conecta Flipy en Integraciones antes de geocodificar.");
    }
    const partnerKey = resolveFlipyPartnerKeyFromIntegration(integration);
    if (!partnerKey) {
      throw new IntegrationError("FLIPY_PARTNER_API_KEY no configurada.");
    }

    const env = getFlipyEnv();
    const client = createFlipyPartnerClient({
      baseUrl: env.apiBaseUrl,
      partnerKey,
      partnerId: env.partnerId,
      externalStoreId: membership.storeId,
    });
    const resolved = await client.reverseGeocode(input.lat, input.lng);
    if (!resolved?.address) {
      throw new ValidationError(
        "No se pudo obtener dirección para el pin. Edítala manualmente.",
      );
    }
    return actionOk(resolved);
  } catch (error) {
    return actionFail(error);
  }
}
